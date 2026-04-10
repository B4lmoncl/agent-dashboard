/**
 * Shared Helper Functions — utilities used across multiple route files.
 */
const {
  state, LEVELS, TIMEZONE,
  XP_BY_RARITY, GOLD_BY_RARITY, RUNENSPLITTER_BY_RARITY,
  RARITY_WEIGHTS, RARITY_COLORS, RARITY_ORDER, STREAK_MILESTONES,
  GEAR_TIERS, SET_BONUSES, EQUIPMENT_SLOTS,
  saveUsers, saveQuests, saveData, ensureUserCurrencies, logActivity,
} = require('./state');

// Lazy-loaded to avoid circular dependency (talent-tree.js requires helpers.js)
let _getUserTalentEffects = null;
let _talentLoadAttempted = false;
// Per-request cache: cleared after each quest completion cycle via clearRequestCache()
const _talentCache = new Map();
const _legendaryCache = new Map();
function getTalentEffects(userId) {
  if (_talentCache.has(userId)) return _talentCache.get(userId);
  if (!_getUserTalentEffects && !_talentLoadAttempted) {
    _talentLoadAttempted = true;
    try {
      _getUserTalentEffects = require('../routes/talent-tree').getUserTalentEffects;
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') console.error('[getTalentEffects] Failed to load:', e.message);
      if (e.code === 'MODULE_NOT_FOUND') _talentLoadAttempted = false;
    }
  }
  const result = _getUserTalentEffects ? _getUserTalentEffects(userId) : {};
  _talentCache.set(userId, result);
  return result;
}
function clearRequestCache() {
  _talentCache.clear();
  _legendaryCache.clear();
}

// ─── Basic helpers ──────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

function todayStr() {
  return getTodayBerlin();
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
  const get = (type) => { const p = parts.find(x => x.type === type); return p ? parseInt(p.value, 10) : 0; };
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

function randGold(rarity) {
  const range = GOLD_BY_RARITY[rarity] || [6, 12];
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Bond Level ─────────────────────────────────────────────────────────────
function getBondLevel(bondXp) {
  const xp = bondXp || 0;
  if (!state.BOND_LEVELS?.length) return { level: 1, title: 'Stranger', minXp: 0 };
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

function getStreakXpBonus(streak) {
  const m = getStreakMilestone(streak);
  return m ? m.xpBonus / 100 : 0;
}

function updateUserStreak(userId) {
  const u = state.users[userId];
  if (!u) return;
  // Skip streak update if player is in tavern rest mode
  if (u.tavernRest?.active) return;
  const today = todayStr();
  if (u.streakLastDate === today) return;
  // Talent tree: streak_grace_period_hours extends the window for "yesterday" check
  const graceHours = getTalentEffects(userId).streak_grace_period_hours || 0;
  const graceMsAdj = graceHours * 3600000;
  const yesterday = new Date(Date.now() - 86400000 - graceMsAdj).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  if (u.streakLastDate === yesterday) {
    u.streakDays = (u.streakDays || 0) + 1;
  } else if (u.streakDays > 0) {
    // Workshop Streak Shield Charm: auto-saves N times per week (tier 1=1x, tier 2=2x)
    const charmMaxUses = getWorkshopBonus(userId, 'streak_charm'); // 0, 1, or 2
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);
    const weekStartMs = weekStart.getTime();
    const charmUsesThisWeek = (u.streakCharmUses || []).filter(ts => new Date(ts).getTime() >= weekStartMs).length;
    const charmReady = charmMaxUses > 0 && charmUsesThisWeek < charmMaxUses;
    if (charmReady) {
      u.streakCharmUses = u.streakCharmUses || [];
      u.streakCharmUses.push(new Date().toISOString());
      // Prune old entries (keep last 4 weeks)
      u.streakCharmUses = u.streakCharmUses.filter(ts => Date.now() - new Date(ts).getTime() < 28 * 24 * 3600000);
      u.streakDays = (u.streakDays || 0) + 1;
    } else
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
  // Track login day in calendar history (so the Login-Kalender shows all active days)
  if (!u.dailyClaimHistory) u.dailyClaimHistory = [];
  if (!u.dailyClaimHistory.includes(today)) u.dailyClaimHistory.push(today);
  if (u.dailyClaimHistory.length > 90) u.dailyClaimHistory = u.dailyClaimHistory.slice(-90);
  if (u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + 0.25;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  // Streak currencies moved to daily bonus claim endpoint (POST /api/daily-bonus/claim)
  // No longer awarded silently here — player must actively claim

  // Log streak milestones to activity feed (7, 14, 21, 30, 50, 100 days etc.)
  const streakDays = u.streakDays || 0;
  // Streak milestone cosmetics — earned once, kept forever (Duolingo-style streak society)
  const STREAK_COSMETICS = [
    { days: 7,   titleId: 'streak-bronze',  titleName: 'Flammenhüter',     titleRarity: 'uncommon', frame: null },
    { days: 30,  titleId: 'streak-silver',  titleName: 'Unerschütterlich', titleRarity: 'rare',     frame: { id: 'streak-30d', name: 'Flammenrahmen', color: '#f59e0b', glow: false } },
    { days: 90,  titleId: 'streak-gold',    titleName: 'Eiserner Wille',   titleRarity: 'epic',     frame: { id: 'streak-90d', name: 'Glutrahmen',    color: '#ef4444', glow: true } },
    { days: 180, titleId: 'streak-diamond', titleName: 'Diamantflamme',    titleRarity: 'epic',     frame: { id: 'streak-180d', name: 'Inferno',      color: '#f97316', glow: true } },
    { days: 365, titleId: 'streak-legend',  titleName: 'Die Ewige Flamme', titleRarity: 'legendary', frame: { id: 'streak-365d', name: 'Ewige Flamme', color: '#fbbf24', glow: true } },
  ];
  for (const m of STREAK_MILESTONES) {
    if (streakDays === m.days) {
      logActivity(userId, 'streak_milestone', { days: m.days, badge: m.badge, label: m.label });
      // Award streak title + frame if applicable
      const cosmetic = STREAK_COSMETICS.find(c => c.days === m.days);
      if (cosmetic) {
        if (!u.earnedTitles) u.earnedTitles = [];
        if (!u.earnedTitles.some(t => t.id === cosmetic.titleId)) {
          u.earnedTitles.push({ id: cosmetic.titleId, name: cosmetic.titleName, rarity: cosmetic.titleRarity, source: `${m.days}-day streak`, earnedAt: new Date().toISOString() });
        }
        if (cosmetic.frame) {
          if (!u.unlockedFrames) u.unlockedFrames = [];
          if (!u.unlockedFrames.some(f => f.id === cosmetic.frame.id)) {
            u.unlockedFrames.push({ ...cosmetic.frame, source: `${m.days}-day streak`, earnedAt: new Date().toISOString() });
          }
        }
      }
      break;
    }
  }
}

// ─── Economy helpers ────────────────────────────────────────────────────────
function awardUserGold(userId, rarity, streakDays, extraMulti) {
  const u = state.users[userId];
  if (!u) return;
  const base = randGold(rarity);
  // Streak gold bonus: +0.5% per day, soft cap via diminishing returns (max ~20% at 60+ days)
  const streakMulti = 1 + diminishing(streakDays || 0, 0.20, 30);
  const forgeMulti = getGoldMultiplier(userId);
  // Legendary gear gold bonus + leather armor trait bonus
  const legendaryGoldMod = getLegendaryModifiers(userId).goldBonus;
  const leatherGoldMod = 1 + (getArmorTraitBonus(userId).goldBonus || 0);
  let goldEarned = Math.round(base * (streakMulti || 1) * (forgeMulti || 1) * (legendaryGoldMod || 1) * (leatherGoldMod || 1) * (extraMulti || 1));
  if (!isFinite(goldEarned) || isNaN(goldEarned)) goldEarned = base;
  // Talent tree: flat gold bonus (added after multipliers)
  const talentFlatGold = getTalentEffects(userId).flat_gold_bonus || 0;
  if (talentFlatGold > 0) goldEarned += talentFlatGold;
  // Passive: gold_boost_next doubles gold, consumed after use
  if (consumePassiveEffect(userId, 'gold_boost_next')) {
    goldEarned *= 2;
  }
  u.gold = (u.gold || 0) + goldEarned;
  ensureUserCurrencies(u);
  u.currencies.gold = u.gold;
  u._lastGoldEarned = goldEarned;
}

function awardCurrency(userId, currency, amount) {
  const u = state.users[userId];
  if (!u || !amount || amount <= 0) return;
  ensureUserCurrencies(u);
  u.currencies[currency] = (u.currencies[currency] || 0) + Math.floor(amount);
  // Keep u.gold in sync when awarding gold via currency system
  if (currency === 'gold') u.gold = u.currencies.gold;
}

function spendCurrency(userId, currency, amount) {
  const u = state.users[userId];
  if (!u || !amount || amount <= 0) return false;
  ensureUserCurrencies(u);
  if ((u.currencies[currency] || 0) < amount) return false;
  u.currencies[currency] -= amount;
  // Keep u.gold in sync when spending gold via currency system
  if (currency === 'gold') u.gold = u.currencies.gold;
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
  const flatBonus = u._pendingForgeTempFlat || 0;
  u._pendingForgeTempFlat = 0;
  u.forgeTemp = Math.min(100, (u.forgeTemp ?? 100) + Math.round(baseRecovery * tempoMulti) + flatBonus);
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
  // Talent tree: hoarding_threshold_bonus — raises the free quest limit
  const talentHoardingBonus = getTalentEffects(userId).hoarding_threshold_bonus || 0;
  const overLimit = Math.max(0, total - (20 + talentHoardingBonus));
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
  if (temp >= 100) return 1.25;
  if (temp >= 80) return 1.15;
  if (temp >= 60) return 1.10;
  if (temp >= 40) return 1.0;
  if (temp >= 20) return 0.85;
  return 0.6;
}

// Diminishing returns formula: bonus = maxBonus * stat / (stat + softCap)
// At softCap stat: 50% of maxBonus. Never hard-caps — always gains slightly more.
function diminishing(stat, maxBonus, softCap) {
  if (stat <= 0) return 0;
  return maxBonus * stat / (stat + softCap);
}

function getKraftBonus(userId) {
  const stats = getUserStats(userId);
  // Linear: +0.5% XP per Kraft point. No cap — limited by gear budget (7 slots, max ~24 Kraft BiS).
  // At 10: +5%, at 20: +10%, at 30 (cap): +15%
  return +(1 + (stats.kraft || 0) * 0.005).toFixed(4);
}

function getXpMultiplier(userId) {
  return +(getForgeXpBase(userId) * getKraftBonus(userId)).toFixed(4);
}

function getForgeGoldBase(userId) {
  const temp = calcDynamicForgeTemp(userId);
  if (temp >= 100) return 1.25;
  if (temp >= 80) return 1.15;
  if (temp >= 60) return 1.08;
  return 1.0;
}

function getWeisheitBonus(userId) {
  const stats = getUserStats(userId);
  // Linear: +0.4% Gold per Weisheit point. No cap — limited by gear budget.
  // At 10: +4%, at 20: +8%, at 30: +12%
  return +(1 + (stats.weisheit || 0) * 0.004).toFixed(4);
}

// Workshop upgrade bonuses — additive permanent bonuses
function getWorkshopBonus(userId, upgradeId) {
  const u = state.users[userId];
  if (!u || !u.workshopUpgrades) return 0;
  const tier = u.workshopUpgrades[upgradeId] || 0;
  if (tier === 0) return 0;
  const upgradeDefs = state.store.shopData?.workshopUpgrades || [];
  const def = upgradeDefs.find(up => up.id === upgradeId);
  if (!def) return 0;
  const tierDef = def.tiers.find(t => t.tier === tier);
  return tierDef?.value || 0;
}

function getGoldMultiplier(userId) {
  const workshopGoldPct = getWorkshopBonus(userId, 'gold_tools');
  const workshopGold = 1 + workshopGoldPct / 100; // additive: +2-5%
  return +(getForgeGoldBase(userId) * getWeisheitBonus(userId) * workshopGold).toFixed(4);
}

function calcDynamicForgeTemp(userId) {
  const u = state.users[userId];
  if (!u) return 0;
  // Freeze forge temp during tavern rest
  if (u.tavernRest?.active) return Math.min(100, Math.max(0, Math.round(u.tavernRest.forgeFrozenAt ?? u.forgeTemp ?? 0)));
  const stored = u.forgeTemp ?? 0;
  if (!u.forgeTempAt) return Math.min(100, Math.max(0, Math.round(stored)));
  // Base decay: 2%/h, reduced by 0.5% per Ausdauer point (multiplier floor 0.1 → min 0.2%/h)
  const stats = _getRawStats(userId);
  const ausdauerMultiplier = Math.max(0.1, 1 - (stats.ausdauer || 0) * 0.005);
  // Legendary gear decay reduction + talent tree
  const legendaryDecayReduction = getLegendaryModifiers(userId).decayReduction;
  const talentDecayReduction = getTalentEffects(userId).forge_decay_reduction || 0;
  const decayRate = 2 * ausdauerMultiplier * Math.max(0.1, 1 - legendaryDecayReduction - talentDecayReduction);
  const hoursElapsed = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
  const decayed = stored - hoursElapsed * decayRate;
  return Math.min(100, Math.max(0, Math.round(decayed)));
}

// Calculate the current rested XP pool for display (read-only, does not mutate user).
// Mirrors the accumulation logic in awardXp() but computes it live at request time
// so the frontend always shows the up-to-date value — not a stale snapshot from the
// last quest completion.
function calcRestedXpPool(userId) {
  const u = state.users[userId];
  if (!u) return 0;
  const stored = u._restedXpPool || 0;
  const lastQuestAt = u._lastQuestCompletedAt ? new Date(u._lastQuestCompletedAt).getTime() : 0;
  if (lastQuestAt <= 0) return stored;
  const hoursSince = (Date.now() - lastQuestAt) / 3600000;
  if (hoursSince < 8) return stored; // Only accumulate after 8h offline
  const lvl = getLevelInfo(u.xp || 0);
  const xpForLevel = lvl.nextXp ? (lvl.nextXp - lvl.xpRequired) : 1000;
  const talentEffects = getTalentEffects(userId);
  const restedAccBonus = 1 + (talentEffects.rested_xp_accumulation_bonus || 0);
  const gainPerHour = ((xpForLevel * 0.05) / 8) * restedAccBonus;
  const maxPool = Math.round(xpForLevel * 1.5 * restedAccBonus);
  const accumulated = Math.round(hoursSince * gainPerHour);
  return Math.min(maxPool, stored + accumulated);
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
      // Add socketed gem bonuses
      if (item.sockets && Array.isArray(item.sockets)) {
        const gemsData = state.gemsData || require('../public/data/gems.json');
        for (const gemKey of item.sockets) {
          if (!gemKey) continue;
          const parts = gemKey.split('_');
          if (parts.length < 2) continue;
          const gemTierStr = parts[parts.length - 1];
          const gemType = parts.slice(0, -1).join('_');
          const gemDef = gemsData.gems.find(g => g.id === gemType);
          if (!gemDef) continue;
          const tierDef = gemDef.tiers.find(t => t.tier === parseInt(gemTierStr, 10));
          if (!tierDef) continue;
          stats[gemDef.stat] = (stats[gemDef.stat] || 0) + tierDef.statBonus;
        }
      }
    }
  }
  return { stats, items };
}

/**
 * Get detailed stat breakdown per source (for stat tooltip click-to-expand).
 * Returns: { kraft: [{ source: "Helm: Eisenhelm", value: 3 }, ...], ... }
 */
function getStatBreakdown(userId) {
  const u = state.users[userId];
  if (!u) return {};
  const equipped = u.equipment || {};
  const breakdown = {};
  for (const s of ALL_STATS) breakdown[s] = [];

  // Per-slot gear contributions
  for (const [slot, val] of Object.entries(equipped)) {
    let item;
    if (typeof val === 'object' && val !== null && val.instanceId) item = val;
    else if (typeof val === 'string') {
      item = state.gearById.get(val);
      if (!item) { const tmpl = state.itemTemplates?.get(val); if (tmpl) item = { ...tmpl, stats: tmpl.stats || {} }; }
    }
    if (!item) continue;
    for (const [stat, sval] of Object.entries(item.stats || {})) {
      if (sval > 0 && breakdown[stat]) {
        breakdown[stat].push({ source: `${slot}: ${item.name}`, value: sval, type: 'gear' });
      }
    }
    // Gem contributions
    if (item.sockets && Array.isArray(item.sockets)) {
      const gemsData = state.gemsData || require('../public/data/gems.json');
      for (const gemKey of item.sockets) {
        if (!gemKey) continue;
        const parts = gemKey.split('_');
        const gemType = parts.slice(0, -1).join('_');
        const gemTier = parseInt(parts[parts.length - 1], 10);
        const gemDef = gemsData.gems.find(g => g.id === gemType);
        if (!gemDef) continue;
        const tierDef = gemDef.tiers.find(t => t.tier === gemTier);
        if (!tierDef || !gemDef.stat) continue;
        if (breakdown[gemDef.stat]) {
          breakdown[gemDef.stat].push({ source: `Gem: ${gemDef.name || gemType} T${gemTier}`, value: tierDef.statBonus, type: 'gem' });
        }
      }
    }
  }

  // Set bonus contributions
  const equippedItems = Object.values(equipped).filter(v => v && typeof v === 'object');
  const setCount = {};
  for (const item of equippedItems) setCount[item.setId] = (setCount[item.setId] || 0) + 1;
  for (const [setId, count] of Object.entries(setCount)) {
    let bonusPct = 0;
    if (count >= 7) bonusPct = 10;
    else if (count >= 4) bonusPct = 5;
    if (bonusPct > 0) {
      for (const stat of PRIMARY_STATS) {
        const gearTotal = breakdown[stat].filter(e => e.type === 'gear').reduce((s, e) => s + e.value, 0);
        const setVal = Math.round(gearTotal * bonusPct / 100);
        if (setVal > 0) breakdown[stat].push({ source: `Set (${count}pc): +${bonusPct}%`, value: setVal, type: 'set' });
      }
    }
  }

  // Armor trait
  const armorTrait = getArmorTraitBonus(userId);
  if (armorTrait.flatAusdauer > 0) {
    breakdown.ausdauer.push({ source: 'Heavy Armor Trait', value: armorTrait.flatAusdauer, type: 'trait' });
  }

  return breakdown;
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

// ─── Affix Rolling System ────────────────────────────────────────────────────
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
function rollAffixStats(template, moonlightBonus = 0) {
  if (!template || !template.affixes) {
    // Legacy fallback: return old fixed stats if no affixes defined
    return { stats: template?.stats || {} };
  }
  const stats = {};
  const { primary, minor } = template.affixes;

  // Moonlight bonus: raises minimum roll by % of range (0.0 = off, 0.2 = +20% min)
  const applyMoonlight = (min, max) => {
    if (moonlightBonus <= 0) return min;
    const range = max - min;
    return Math.min(max, min + Math.floor(range * moonlightBonus));
  };

  // Roll primary affixes
  if (primary && primary.pool && primary.pool.length > 0) {
    const [minCount, maxCount] = primary.count || [1, 1];
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    // Shuffle pool and pick `count` unique stats
    const shuffled = shuffle(primary.pool);
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));
    for (const affix of picked) {
      if (!affix.stat || affix.min == null || affix.max == null) continue;
      const effectiveMin = applyMoonlight(affix.min, affix.max);
      stats[affix.stat] = effectiveMin + Math.floor(Math.random() * (affix.max - effectiveMin + 1));
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
        const effectiveMinM = applyMoonlight(affix.min, affix.max);
        stats[affix.stat] = effectiveMinM + Math.floor(Math.random() * (affix.max - effectiveMinM + 1));
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
function createGearInstance(template, { moonlightBonus = 0 } = {}) {
  const setIds = ['adventurer', 'veteran', 'master', 'legendary'];
  // Generate sockets based on rarity
  const gemsData = state.gemsData || require('../public/data/gems.json');
  const socketRange = gemsData.socketsByRarity[template.rarity || 'common'] || [0, 0];
  const socketCount = socketRange[0] + Math.floor(Math.random() * (socketRange[1] - socketRange[0] + 1));

  // fixedStats items (filler crafts) skip affix rolling entirely
  let stats, legendaryEffect;
  if (template.fixedStats === true && template.stats) {
    stats = { ...template.stats };
    legendaryEffect = template.legendaryEffect ? { ...template.legendaryEffect } : null;
  } else if (typeof template.fixedStats === 'object' && template.fixedStats.stats) {
    stats = { ...template.fixedStats.stats };
    legendaryEffect = template.legendaryEffect ? { ...template.legendaryEffect } : null;
  } else if (template.fixedStats) {
    // Legacy fallback: fixedStats is the stats object itself
    stats = { ...template.fixedStats };
    legendaryEffect = null;
  } else {
    ({ stats, legendaryEffect } = rollAffixStats(template, moonlightBonus));
  }

  return {
    instanceId: `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId: template.id,
    name: template.name,
    slot: template.slot,
    tier: template.tier || 1,
    rarity: template.rarity || 'common',
    armorType: template.armorType || null,
    stats,
    sockets: Array(socketCount).fill(null),
    legendaryEffect: legendaryEffect || null,
    setId: template.setId || setIds[(template.tier || 1) - 1] || 'adventurer',
    desc: template.desc || template.flavorText || '',
    icon: template.icon || null,
    passiveEffect: template.passiveEffect || null,
    passiveDesc: template.passiveDesc || null,
    affixes: template.fixedStats ? null : (template.affixes || null),
    fixedStats: !!template.fixedStats,
    binding: template.binding || null,
    bound: template.binding === 'bop' ? true : false,
    rolledAt: now(),
  };
}

/**
 * Roll a random suffix onto a gear instance (WoW Classic style).
 * 30% chance. Only for dropped items, never crafted.
 * Adds flat stats based on item level + appends suffix to name.
 */
function rollSuffix(gearInstance) {
  let suffixData;
  try { suffixData = require('../public/data/suffixes.json'); } catch { return gearInstance; }
  if (!suffixData?.suffixes?.length) return gearInstance;
  if (Math.random() > (suffixData.config?.dropChance || 0.30)) return gearInstance;

  const suffix = suffixData.suffixes[Math.floor(Math.random() * suffixData.suffixes.length)];
  const reqLevel = gearInstance.reqLevel || gearInstance.tier * 10 || 1;
  // Find appropriate scaling bracket (10/20/30/40/50)
  const brackets = Object.keys(suffix.scaling).map(Number).sort((a, b) => a - b);
  let bracket = brackets[0];
  for (const b of brackets) { if (reqLevel >= b) bracket = b; }
  const bonusStats = suffix.scaling[bracket] || {};

  // Apply suffix stats additively
  for (const [stat, val] of Object.entries(bonusStats)) {
    gearInstance.stats[stat] = (gearInstance.stats[stat] || 0) + val;
  }

  // Append suffix to name
  gearInstance.name = gearInstance.name + ' ' + suffix.name;
  gearInstance.suffix = { id: suffix.id, name: suffix.name, color: suffix.color, stats: bonusStats };

  return gearInstance;
}

/**
 * Create a gear instance from a unique named item template.
 * Unique items roll stats from affix ranges (like normal gear) but have
 * a guaranteed legendary effect that also rolls within a range.
 * Always 3 sockets. One-per-player enforced at drop time.
 */
function createUniqueInstance(uniqueTemplate) {
  let stats, legendaryEffect;

  // Fixed-stats uniques: use predefined stats directly (no rolling)
  if (uniqueTemplate.fixedStats === true && uniqueTemplate.stats) {
    stats = { ...uniqueTemplate.stats };
    legendaryEffect = uniqueTemplate.legendaryEffect ? { ...uniqueTemplate.legendaryEffect } : null;
    // Roll legendary effect value if it has min/max range
    if (legendaryEffect && legendaryEffect.min != null && legendaryEffect.max != null) {
      legendaryEffect.value = legendaryEffect.min + Math.floor(Math.random() * (legendaryEffect.max - legendaryEffect.min + 1));
      if (legendaryEffect.label) legendaryEffect.label = legendaryEffect.label.replace(/\{value\}/g, String(legendaryEffect.value));
    }
  } else if (typeof uniqueTemplate.fixedStats === 'object' && uniqueTemplate.fixedStats.stats) {
    // Handle malformed fixedStats: { stats: {...} } pattern
    stats = { ...uniqueTemplate.fixedStats.stats };
    legendaryEffect = uniqueTemplate.legendaryEffect ? { ...uniqueTemplate.legendaryEffect } : null;
    if (legendaryEffect && legendaryEffect.min != null && legendaryEffect.max != null) {
      legendaryEffect.value = legendaryEffect.min + Math.floor(Math.random() * (legendaryEffect.max - legendaryEffect.min + 1));
      if (legendaryEffect.label) legendaryEffect.label = legendaryEffect.label.replace(/\{value\}/g, String(legendaryEffect.value));
    }
  } else {
    // Normal affix-based uniques: roll from affix pools
    const rolled = rollAffixStats(uniqueTemplate);
    stats = rolled.stats;
    legendaryEffect = rolled.legendaryEffect;
  }

  return {
    instanceId: `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId: uniqueTemplate.id,
    name: uniqueTemplate.name,
    slot: uniqueTemplate.slot,
    tier: uniqueTemplate.tier || 5,
    rarity: 'legendary',
    stats,
    legendaryEffect: legendaryEffect || null,
    setId: null,
    desc: uniqueTemplate.desc || '',
    flavorText: uniqueTemplate.flavorText || '',
    icon: uniqueTemplate.icon || null,
    passiveEffect: null,
    passiveDesc: null,
    affixes: uniqueTemplate.affixes || null,
    isUnique: true,
    sockets: [null, null, null],
    rolledAt: now(),
  };
}

/**
 * Add a unique item ID to a user's collection log if not already present.
 * The collection log tracks all uniques ever obtained (even if dismantled/traded).
 */
function trackUniqueInCollection(userId, uniqueId) {
  const u = state.users[userId];
  if (!u) return;
  if (!u.collectionLog) u.collectionLog = [];
  if (!u.collectionLog.includes(uniqueId)) {
    u.collectionLog.push(uniqueId);
  }
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
    if (count >= 7) setBonus = Math.max(setBonus, 1.10);
    else if (count >= 4) setBonus = Math.max(setBonus, 1.05);
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
  // Armor trait: heavy armor grants flat Ausdauer per piece
  const armorTrait = getArmorTraitBonus(userId);
  if (armorTrait.flatAusdauer > 0) {
    stats.ausdauer = (stats.ausdauer || 0) + armorTrait.flatAusdauer;
  }
  return stats;
}

// ─── Gear Score / Power Level ────────────────────────────────────────────────
// Item Level = sum of all stats + rarity bonus + legendary bonus + socket bonus
// Gear Score = sum of all equipped Item Levels
const RARITY_ILVL_BONUS = { common: 0, uncommon: 5, rare: 15, epic: 30, legendary: 50 };
const LEGENDARY_ILVL_BONUS = 20;
const SOCKET_ILVL_BONUS = 5; // per filled socket

function getItemLevel(item) {
  if (!item) return 0;
  let ilvl = 0;
  // Sum all stat values
  for (const val of Object.values(item.stats || {})) {
    ilvl += (typeof val === 'number' ? val : 0);
  }
  // Rarity bonus
  ilvl += RARITY_ILVL_BONUS[item.rarity] || 0;
  // Legendary effect bonus
  if (item.legendaryEffect) ilvl += LEGENDARY_ILVL_BONUS;
  // Socket bonus (filled sockets only)
  if (item.sockets && Array.isArray(item.sockets)) {
    for (const s of item.sockets) { if (s) ilvl += SOCKET_ILVL_BONUS; }
  }
  // Unique bonus
  if (item.isUnique) ilvl += 25;
  return ilvl;
}

function getGearScore(userId) {
  const u = state.users[userId];
  if (!u) return { gearScore: 0, itemLevels: {} };
  const equipped = u.equipment || {};
  let total = 0;
  const itemLevels = {};
  for (const [slot, item] of Object.entries(equipped)) {
    if (!item || typeof item === 'string') continue;
    const ilvl = getItemLevel(item);
    itemLevels[slot] = ilvl;
    total += ilvl;
    // Add gem stat bonuses from socketed gems
    if (item.sockets && Array.isArray(item.sockets)) {
      for (const gemKey of item.sockets) {
        if (!gemKey) continue;
        const parts = gemKey.split('_');
        if (parts.length < 2) continue;
        const tier = parseInt(parts[parts.length - 1], 10);
        const gemType = parts.slice(0, -1).join('_');
        const gemDef = (state.gemsData?.gems || []).find(g => g.id === gemType);
        if (gemDef) {
          const tierDef = gemDef.tiers.find(t => t.tier === tier);
          if (tierDef) total += Math.floor(tierDef.statBonus / 2); // Gem stat bonus contributes to GS
        }
      }
    }
  }
  return { gearScore: total, itemLevels };
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
  // Include Ätherwürfel active effects
  const cube = u.kanaisCube;
  if (cube) {
    for (const slot of ['offensive', 'defensive', 'utility']) {
      const active = cube[slot];
      if (active?.type && active?.value != null) {
        effects.push({ type: active.type, value: active.value, itemName: `Ätherwürfel (${slot})`, itemId: `cube-${slot}` });
      }
    }
  }
  return effects;
}

// Compute legendary effect bonuses as modifiers
function getLegendaryModifiers(userId) {
  if (_legendaryCache.has(userId)) return _legendaryCache.get(userId);
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
  let critChance = 0;
  let companionBondBoost = 0;
  let cooldownReduction = 0;
  let salvageBonus = 0;
  let factionRepBoost = 0;
  let challengeScoreBonus = 0;
  let dungeonLootBonus = 0;
  let forgeTempFlat = 0;
  let pityReduction = 0;
  let expeditionSpeed = 0;
  let gemPreserve = 0;
  let ritualStreakBonus = 0;
  // New Phase 6 effects
  let doubleQuestChance = 0;
  let berserkerBonus = 0;
  let vampiric = 0;
  let fortify = 0;
  let secondWind = 0;
  let resilience = 0;
  let guardian = 0;
  let prospector = 0;
  let scavenger = 0;
  let mentor = 0;
  let diplomat = 0;
  let cartographer = 0;
  let scholar = 0;
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
    else if (e.type === 'crit_chance') critChance += e.value;
    else if (e.type === 'companion_bond_boost') companionBondBoost += e.value;
    else if (e.type === 'cooldown_reduction') cooldownReduction += e.value;
    else if (e.type === 'salvage_bonus') salvageBonus += e.value;
    else if (e.type === 'faction_rep_boost') factionRepBoost += e.value;
    else if (e.type === 'challenge_score_bonus') challengeScoreBonus += e.value;
    else if (e.type === 'dungeon_loot_bonus') dungeonLootBonus += e.value;
    else if (e.type === 'forge_temp_flat') forgeTempFlat += e.value;
    else if (e.type === 'pity_reduction') pityReduction += e.value;
    else if (e.type === 'expedition_speed') expeditionSpeed += e.value;
    else if (e.type === 'gem_preserve') gemPreserve += e.value;
    else if (e.type === 'ritual_streak_bonus') ritualStreakBonus += e.value;
    // New Phase 6 effects
    else if (e.type === 'double_quest_chance') doubleQuestChance += e.value;
    else if (e.type === 'berserker') berserkerBonus += e.value;
    else if (e.type === 'vampiric') vampiric += e.value;
    else if (e.type === 'fortify') fortify += e.value;
    else if (e.type === 'second_wind') secondWind += e.value;
    else if (e.type === 'resilience') resilience += e.value;
    else if (e.type === 'guardian') guardian += e.value;
    else if (e.type === 'prospector') prospector += e.value;
    else if (e.type === 'scavenger') scavenger += e.value;
    else if (e.type === 'mentor') mentor += e.value;
    else if (e.type === 'diplomat') diplomat += e.value;
    else if (e.type === 'cartographer') cartographer += e.value;
    else if (e.type === 'scholar') scholar += e.value;
  }
  const result = {
    xpBonus: 1 + xpBonus / 100, goldBonus: 1 + goldBonus / 100, dropBonus,
    decayReduction: decayReduction / 100, streakProtection, effects,
    nightDoubleGold, everyNthBonus, autoStreakShieldAt,
    materialDoubleChance: materialDoubleChance / 100, varietyBonusPct,
    critChance: critChance / 100, companionBondBoost: companionBondBoost / 100,
    cooldownReduction: cooldownReduction / 100, salvageBonus: salvageBonus / 100,
    factionRepBoost: factionRepBoost / 100, challengeScoreBonus: challengeScoreBonus / 100,
    dungeonLootBonus: dungeonLootBonus / 100, forgeTempFlat,
    pityReduction, expeditionSpeed: expeditionSpeed / 100,
    gemPreserve: gemPreserve / 100, ritualStreakBonus: ritualStreakBonus / 100,
    doubleQuestChance: doubleQuestChance / 100,
    berserkerBonus: berserkerBonus / 100,
    vampiric: vampiric / 100,
    fortify,
    secondWind: secondWind / 100,
    resilience: resilience / 100,
    guardian,
    prospector: prospector / 100,
    scavenger: scavenger / 100,
    mentor: mentor / 100,
    diplomat: diplomat / 100,
    cartographer: cartographer / 100,
    scholar: scholar / 100,
  };
  _legendaryCache.set(userId, result);
  return result;
}

// ─── Armor Trait Bonus (cloth = +XP, heavy = +Ausdauer) ─────────────────────
function getArmorTraitBonus(userId) {
  const u = state.users[userId];
  if (!u) return { xpBonus: 0, flatAusdauer: 0, goldBonus: 0 };
  const equipment = u.equipment || {};
  let clothCount = 0, heavyCount = 0, leatherCount = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (!item || typeof item !== 'object') continue;
    const template = state.gearById.get(item.templateId) || state.itemTemplates?.get(item.templateId);
    if (template?.armorType === 'cloth') clothCount++;
    else if (template?.armorType === 'heavy') heavyCount++;
    else if (template?.armorType === 'leather') leatherCount++;
  }
  return {
    xpBonus: clothCount * 0.01,       // Arkane Resonanz: +1% XP per cloth piece
    flatAusdauer: heavyCount * 1,      // Eiserne Haut: +1 Ausdauer per heavy piece
    goldBonus: leatherCount * 0.01,    // Geschmeidige Haut: +1% Gold per leather piece
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
  // Linear: +0.3% drop chance per Glück point. No cap — limited by gear budget.
  // At 10: +3%, at 20: +6%, at 30: +9%
  return (stats.glueck || 0) * 0.003 + (legendaryMods.dropBonus || 0);
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

const INVENTORY_CAP = 100;

function addLootToInventory(userId, lootItem) {
  const u = state.users[userId];
  if (!u || !lootItem) return;
  if (!u.inventory) u.inventory = [];
  // Inventory cap — skip loot if inventory is full (except auto-consumed effects)
  const autoConsumed = ['gold', 'xp', 'streak_shield', 'bond', 'forge_temp'].includes(lootItem.effect?.type);
  if (!autoConsumed && u.inventory.length >= INVENTORY_CAP) {
    u._inventoryFull = true;
    return;
  }
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
  if (effectType === 'gold') { u.gold = (u.gold || 0) + lootItem.effect.amount; ensureUserCurrencies(u); u.currencies.gold = u.gold; }
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
    // Use calcDynamicForgeTemp for accurate decay (respects Ausdauer + legendary mods)
    const currentTemp = calcDynamicForgeTemp(userId);
    u.forgeTemp = Math.min(100, currentTemp + (lootItem.effect.amount || 0));
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
      const instance = rollSuffix(createGearInstance(gearTemplate));
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
  if (u._lootPity >= 12) {
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
    // Chain gating: if this achievement has a chainPrev, require it to be earned first
    if (ach.chainPrev && !earned.has(ach.chainPrev)) continue;
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
// Content tier mapping (used for non-quest sources like Rift, World Boss, Dungeons)
const CONTENT_TIER_TO_RARITY = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'epic', 5: 'legendary' };

function rollCraftingMaterials(questRarity, materialDoubleChance, userProfessions, userId, contentTier) {
  // No profession chosen → no material drops (WoW-style: need gathering prof)
  if (!userProfessions?.chosenProfessions?.length) return [];

  // Build set of affinity materials from chosen professions
  const affinityMats = new Set();
  if (state.professionsData?.professions) {
    for (const profDef of state.professionsData.professions) {
      if (!userProfessions.chosenProfessions.includes(profDef.id)) continue;
      for (const matId of (profDef.gatheringAffinity || [])) affinityMats.add(matId);
    }
  }
  if (affinityMats.size === 0) return [];

  // If contentTier is provided, use it to determine rarity instead of questRarity
  const effectiveRarity = contentTier ? (CONTENT_TIER_TO_RARITY[contentTier] || 'common') : questRarity;
  const dropRates = state.professionsData?.materialDropRates || {};
  const rateTable = dropRates[effectiveRarity] || dropRates.common || {};
  const magnetBonus = userId ? getWorkshopBonus(userId, 'material_magnet') / 100 : 0; // +5-15%
  // Talent: guaranteed_material_drop — additional chance for material drops (capped at +0.15)
  const rawTalentMat = userId ? (getTalentEffects(userId).guaranteed_material_drop || 0) : 0;
  const talentMatChance = Math.min(rawTalentMat > 1 ? rawTalentMat / 100 : rawTalentMat, 0.15);
  const drops = [];
  // Only drop materials that are in the player's profession affinities
  for (const [matId, chance] of Object.entries(rateTable)) {
    if (!affinityMats.has(matId)) continue;
    if (Math.random() < (chance + magnetBonus + talentMatChance)) {
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
      // Calculate profession level from skill (0-300 system, ~30 skill per level)
      const profSkill = profData.skill || profData.xp || 0;
      if (profSkill < 1) continue;
      const profLevel = Math.max(1, Math.min(10, Math.floor(profSkill / 30) + 1));
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

  // ─── Daily Diminishing Returns (WoW Classic "Rested XP" inverse) ──────
  // First 5 quests/day: full rewards. Then diminishing.
  // Prevents instant-completing 50 quests for full value.
  const today = getTodayBerlin();
  if (!u._dailyCompletions || u._dailyCompletions.date !== today) {
    u._dailyCompletions = { date: today, count: 0 };
  }
  u._dailyCompletions.count++;
  const dailyCount = u._dailyCompletions.count;

  // ─── Rested XP Pool (WoW Classic style) ────────────────────────────────
  // Accumulates while offline: 5% of current level's XP per 8h, max 150% of level
  // When active, doubles XP earned until the pool is depleted
  const lastQuestAt = u._lastQuestCompletedAt ? new Date(u._lastQuestCompletedAt).getTime() : 0;
  const hoursSinceLastQuest = lastQuestAt > 0 ? (Date.now() - lastQuestAt) / 3600000 : 0;
  const currentLevelInfo = getLevelInfo(u.xp || 0);
  const xpForCurrentLevel = currentLevelInfo.nextXp ? (currentLevelInfo.nextXp - currentLevelInfo.xpRequired) : 1000;

  // Accumulate rested XP on first quest of the day
  // Talent tree: rested_xp_accumulation_bonus increases rested XP gain rate
  const talentEffects = getTalentEffects(userId);
  const restedAccBonus = 1 + (talentEffects.rested_xp_accumulation_bonus || 0);
  if (dailyCount === 1 && hoursSinceLastQuest >= 8) {
    const restedGainPerHour = ((xpForCurrentLevel * 0.05) / 8) * restedAccBonus; // 5% per 8h = 0.625%/h
    const maxRestedPool = Math.round(xpForCurrentLevel * 1.5 * restedAccBonus); // Cap at 150% of level
    const accumulated = Math.round(hoursSinceLastQuest * restedGainPerHour);
    u._restedXpPool = Math.min(maxRestedPool, (u._restedXpPool || 0) + accumulated);
  }
  // NOTE: _lastQuestCompletedAt is set AFTER chain bonus calculation below (not here)

  // Rested XP multiplier: doubles XP, consumes from pool
  let restedMulti = 1.0;

  // Diminishing: 1-5 = 100%, 6-10 = 75%, 11-20 = 50%, 21+ = 25%
  const dailyDiminishing = dailyCount <= 5 ? 1.0 : dailyCount <= 10 ? 0.75 : dailyCount <= 20 ? 0.50 : 0.25;

  const userStats = getUserStats(userId);
  const xpBase = (XP_BY_RARITY[quest.rarity] || 10) + Math.min(50, userStats.fokus || 0); // minor stat: fokus adds flat XP (capped at +50)
  const xpMulti = getXpMultiplier(userId);
  // Talent: codex_permanent_xp — +0.1% XP per codex entry discovered (max 5%)
  const codexEffect = talentEffects.codex_permanent_xp;
  let codexXpBonus = 1;
  if (codexEffect) {
    const discoveredCount = Math.min((u.codexDiscovered || []).length, codexEffect.maxEntries || 50);
    codexXpBonus = 1 + discoveredCount * (codexEffect.perEntryPercent || 0.001);
  }
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
    // Handle both quest-counted (questsRemaining) and charge-counted (chargesRemaining) buffs
    if (!buff.questsRemaining && !buff.chargesRemaining) continue;
    if (buff.type === 'xp_boost_10') activeXpBuf *= 1.10;
    else if (buff.type === 'xp_boost_5') activeXpBuf *= 1.05;
    else if (buff.type === 'xp_boost_15') activeXpBuf *= 1.15;
    else if (buff.type === 'xp_boost_20') activeXpBuf *= 1.20;
    else if (buff.type === 'xp_boost_25_return') activeXpBuf *= 1.25;
    else if (buff.type === 'xp_boost_50_perfect') activeXpBuf *= 1.50;
    else if (buff.type === 'gold_boost_15') activeGoldBuf *= 1.15;
    else if (buff.type === 'gold_boost_10') activeGoldBuf *= 1.10;
    else if (buff.type === 'feast_buff') { activeXpBuf *= 1.15; activeGoldBuf *= 1.10; }
    else if (buff.type === 'luck_boost_20') { hasLuckBuff = true; }
    else if (buff.type === 'luck_boost_10') { hasLuckBuff = true; }
    else if (buff.type === 'double_reward') { activeXpBuf *= 2.0; activeGoldBuf *= 2.0; }
    else if (buff.type === 'xp_gold_boost') { activeXpBuf *= 1 + (buff.xpPercent || 15) / 100; activeGoldBuf *= 1 + (buff.goldPercent || 10) / 100; }
    else if (buff.type === 'luck_boost') { hasLuckBuff = true; }
    // Stat boost buffs from crafting (alchemist potions, cook meals)
    else if (buff.type === 'gold_boost_20') activeGoldBuf *= 1.20;
    else if (buff.type === 'gold_boost_5') activeGoldBuf *= 1.05;
    else if (buff.type === 'kraft_boost') activeXpBuf *= 1 + (buff.amount || 2) * 0.005; // +0.5% XP per kraft point
    else if (buff.type === 'weisheit_boost') activeGoldBuf *= 1 + (buff.amount || 2) * 0.004; // +0.4% gold per weisheit
    else if (buff.type === 'glueck_boost') { hasLuckBuff = true; }
    // Stat-boost buffs: apply their effect as temporary multipliers (like potions in WoW)
    else if (buff.type === 'ausdauer_boost') { /* ausdauer reduces forge decay — effect is passive via stat, buff just marks duration */ }
    else if (buff.type === 'fokus_boost') { passiveXpBonus += (buff.amount || buff.value || 2); } // flat XP per quest
    else if (buff.type === 'charisma_boost') { /* applied in companion bond section below via checking activeBuffs */ }
    else if (buff.type === 'tempo_boost') { /* tempo improves forge recovery — effect is passive via stat, buff just marks duration */ }
    else if (buff.type === 'vitalitaet_boost') { /* streak protection — evaluated in updateUserStreak via checking activeBuffs */ }
    else if (buff.type === 'craft_xp_boost') { continue; } // Not a quest buff — consumed by crafting.js only
    else if (buff.type === 'companion_bond_boost') { /* companion bond multiplier applied in companion section below */ }
    // Utility buffs that are NOT per-quest: do NOT decrement their charges here
    else if (buff.type === 'craft_discount' || buff.type === 'expedition_speed' || buff.type === 'dungeon_reset' || buff.type === 'rift_time_extend') { continue; }
    // Decrement quest-based counters (only for buffs that should be consumed per quest)
    if (buff.questsRemaining) buff.questsRemaining--;
    // chargesRemaining only decremented for quest-consumable buffs (not utility buffs which skipped via continue)
  }
  // Remove fully consumed buffs (questsRemaining or chargesRemaining reached 0)
  u.activeBuffs = u.activeBuffs.filter(b => {
    if (b.questsRemaining !== null && b.questsRemaining !== undefined && b.questsRemaining <= 0) return false;
    if (b.chargesRemaining !== null && b.chargesRemaining !== undefined && b.chargesRemaining <= 0) return false;
    return true;
  });
  // Legendary: every-Nth quest bonus XP
  let nthBonus = 1;
  if (legendaryMods.everyNthBonus > 0 && u.questsCompleted % 5 === 0) {
    nthBonus = 1 + legendaryMods.everyNthBonus / 100;
  }
  // Legendary + Talent: variety bonus — +X% XP per different quest type completed today
  let varietyBonus = 1;
  const talentVarietyEffect = talentEffects.variety_chain_bonus; // complex object: { bonusPerStack, maxStacks }
  const talentVarietyPct = talentVarietyEffect ? (talentVarietyEffect.bonusPerStack || 0) : 0;
  if (legendaryMods.varietyBonusPct > 0 || talentVarietyPct > 0) {
    const tc = state.todayCompletions[userId];
    let typesToday = tc?.types ? (tc.types instanceof Set ? tc.types.size : Object.keys(tc.types).length) : 0;
    // Include current quest's type (recordUserCompletion runs AFTER XP calc)
    const currentType = quest.type || 'development';
    if (tc?.types && !(tc.types instanceof Set ? tc.types.has(currentType) : tc.types[currentType])) typesToday++;
    typesToday = Math.max(1, typesToday);
    const cappedTypes = talentVarietyEffect ? Math.min(typesToday, talentVarietyEffect.maxStacks || 99) : typesToday;
    varietyBonus = 1 + (typesToday * legendaryMods.varietyBonusPct) / 100 + (cappedTypes * talentVarietyPct);
  }
  // Legendary + Talent: night bonuses
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 5; // Aligned with _nightCompletions counter (22:00-05:00)
  if (isNight && legendaryMods.nightDoubleGold > 0) {
    activeGoldBuf *= 1 + legendaryMods.nightDoubleGold / 100;
  }
  // Talent: night_xp_bonus — bonus XP during night hours
  const talentNightXp = talentEffects.night_xp_bonus || 0;
  if (isNight && talentNightXp > 0) {
    activeXpBuf *= 1 + talentNightXp;
  }
  // Talent: weekend_xp_bonus — bonus XP on weekends
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const talentWeekendXp = talentEffects.weekend_xp_bonus || 0;
  if (isWeekend && talentWeekendXp > 0) {
    activeXpBuf *= 1 + talentWeekendXp;
  }
  // Legendary: crit_chance — chance for double quest rewards
  let critMulti = 1;
  if (legendaryMods.critChance > 0 && Math.random() < legendaryMods.critChance) {
    critMulti = 2;
  }
  // Legendary: berserker — +X% XP when Forge Temp > 80%
  if (legendaryMods.berserkerBonus > 0 && calcDynamicForgeTemp(userId) > 80) {
    activeXpBuf *= 1 + legendaryMods.berserkerBonus;
  }
  // Legendary: double_quest_chance — X% chance for double rewards
  if (legendaryMods.doubleQuestChance > 0 && Math.random() < legendaryMods.doubleQuestChance) {
    critMulti *= 2; // Stacks multiplicatively with crit_chance
  }
  // Legendary: forgeTempFlat — bonus forge temp per quest (applied in updateUserForgeTemp below)
  if (legendaryMods.forgeTempFlat > 0) {
    u._pendingForgeTempFlat = legendaryMods.forgeTempFlat;
  }
  // Talent: nth_quest_gamble — every Nth quest: coin flip for double or halve rewards
  const nthGamble = talentEffects.nth_quest_gamble;
  let gambleMulti = 1;
  if (nthGamble && nthGamble.everyN > 0 && (u.questsCompleted || 0) % nthGamble.everyN === 0) {
    gambleMulti = Math.random() < (nthGamble.doubleChance || 0.5) ? 2 : 0.5;
    u._lastGambleResult = gambleMulti === 2 ? 'double' : 'halved';
  }
  // Talent: completion_chain_bonus — bonus XP for consecutive quests within time window
  const chainEffect = talentEffects.completion_chain_bonus;
  let chainBonus = 1;
  if (chainEffect) {
    const windowMs = (chainEffect.windowMinutes || 60) * 60000;
    const lastAt = u._lastQuestCompletedAt ? new Date(u._lastQuestCompletedAt).getTime() : 0;
    if (lastAt > 0 && (Date.now() - lastAt) < windowMs) {
      u._questChainCount = Math.min((u._questChainCount || 0) + 1, chainEffect.maxStacks || 10);
    } else {
      u._questChainCount = 0;
    }
    chainBonus = 1 + (u._questChainCount * (chainEffect.bonusPerChain || 0.05));
  }
  // Update timestamp AFTER chain bonus calculation (must read old value first)
  u._lastQuestCompletedAt = now();
  // Armor trait bonus (cloth = +1% XP per piece)
  const armorTraitMod = 1 + getArmorTraitBonus(userId).xpBonus;
  // Calculate base XP first (without rested)
  let xpWithoutRested = Math.round(xpBase * (xpMulti || 1) * (gearBonus || 1) * (companionBonus || 1) * (bondBonus || 1) * (hoardingMalus || 1) * (passiveXpBonus || 1) * (legendaryMods.xpBonus || 1) * (activeXpBuf || 1) * (nthBonus || 1) * (varietyBonus || 1) * (critMulti || 1) * (armorTraitMod || 1) * (codexXpBonus || 1) * (gambleMulti || 1) * (chainBonus || 1) * dailyDiminishing);
  if (!isFinite(xpWithoutRested) || isNaN(xpWithoutRested)) xpWithoutRested = xpBase;
  xpWithoutRested = Math.max(1, xpWithoutRested); // Floor: always award at least 1 XP
  // Apply Rested XP: doubles the XP, consuming from pool
  let restedBonusXp = 0;
  if ((u._restedXpPool || 0) > 0) {
    restedBonusXp = Math.min(xpWithoutRested, u._restedXpPool); // Bonus = min(earned, pool)
    u._restedXpPool = Math.max(0, (u._restedXpPool || 0) - restedBonusXp);
    restedMulti = 1 + (restedBonusXp / xpWithoutRested); // Effective multiplier for display
  }
  let xpEarned = xpWithoutRested + restedBonusXp;
  const prevLevel = getLevelInfo(u.xp || 0).level;
  u.xp = (u.xp || 0) + xpEarned;
  u.seasonXp = (u.seasonXp || 0) + xpEarned;
  u._lastXpEarned = xpEarned;
  u._lastRestedBonusXp = restedBonusXp;
  u._lastRestedPoolRemaining = u._restedXpPool || 0;
  u._lastDailyDiminishing = dailyDiminishing;
  u._lastDailyCount = dailyCount;
  // Legendary: vampiric — X% of earned XP becomes Bond XP
  if (legendaryMods.vampiric > 0 && u.companion) {
    const bondXpFromVampiric = Math.round(xpEarned * legendaryMods.vampiric);
    if (bondXpFromVampiric > 0) {
      u.companion.bondXp = (u.companion.bondXp || 0) + bondXpFromVampiric;
      u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
    }
  }
  if (quest.type === 'companion' && u.companion) {
    const prevBondLevel = getBondLevel(u.companion.bondXp || 0).level;
    // Charisma from gear + active charisma_boost buff
    const charismaBuff = (u.activeBuffs || []).find(b => b.type === 'charisma_boost' && (b.questsRemaining || 0) > 0);
    const totalCharisma = (userStats.charisma || 0) + (charismaBuff ? (charismaBuff.amount || charismaBuff.value || 3) : 0);
    const charismaBonus = 1 + totalCharisma * 0.05; // minor stat: +5% bond XP per charisma
    const bondLegendaryBonus = 1 + (legendaryMods.companionBondBoost || 0); // legendary: companion_bond_boost
    const talentBondBonus = 1 + (talentEffects.companion_bond_xp_bonus || 0); // talent: companion bond XP
    const actualBondXp = +(1 * charismaBonus * bondLegendaryBonus * talentBondBonus).toFixed(2);
    u.companion.bondXp = (u.companion.bondXp || 0) + actualBondXp;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
    u._lastCompanionReward = {
      companionName: u.companion.name,
      companionType: u.companion.type,
      bondXpGained: actualBondXp,
      newBondXp: u.companion.bondXp,
      newBondLevel: u.companion.bondLevel,
      bondLevelUp: u.companion.bondLevel > prevBondLevel,
      bondTitle: getBondLevel(u.companion.bondXp).title,
    };
  }
  updateUserStreak(userId);
  // Talent: first_quest_gold_bonus — extra gold on first quest of the day
  let questGoldBuf = activeGoldBuf;
  const talentFirstQuestGold = talentEffects.first_quest_gold_bonus || 0;
  if (dailyCount === 1 && talentFirstQuestGold > 0) {
    questGoldBuf *= 1 + talentFirstQuestGold;
  }
  awardUserGold(userId, quest.rarity || 'common', u.streakDays, questGoldBuf * dailyDiminishing * critMulti * gambleMulti);
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
  // Note: weekend_xp_bonus talent is applied in the XP calculation above via activeXpBuf
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
  u._personalCount = (u._personalCount || 0) + (quest.type === 'personal' ? 1 : 0);
  if (quest.parentQuestId) {
    const parent = state.questsById.get(quest.parentQuestId);
    if (parent && parent.type === 'boss') {
      const children = state.quests.filter(q => q.parentQuestId === parent.id);
      const allDone = children.every(c => c.status === 'completed' || c.id === quest.id);
      if (allDone) { u._bossDefeated = true; u._bossesDefeated = (u._bossesDefeated || 0) + 1; }
    }
  }
  // ── Codex discovery (BEFORE achievements so codex achievements can fire) ──
  try {
    const { checkCodexDiscovery } = require('../routes/codex');
    const newCodex = checkCodexDiscovery(userId);
    if (newCodex.length > 0) u._lastCodexDiscovery = newCodex;
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') console.warn('[helpers] codex discovery error:', e.message);
  }
  const newAchs = checkAndAwardAchievements(userId);
  checkAndAwardTitles(userId);
  // Progress faction daily quests
  try { const { progressFactionDailies } = require('../routes/factions'); progressFactionDailies(userId, quest); } catch (e) { console.warn('[bp-xp] faction-dailies:', e.message); }
  // ── Faction reputation ──
  try {
    const { grantReputation } = require('../routes/factions');
    const repResults = grantReputation(u, quest.type || 'development', quest.rarity || 'common');
    if (repResults.length > 0) u._lastRepGains = repResults;
  } catch { /* factions module not loaded yet */ }
  // ── Battle Pass XP ──
  try {
    const { grantBattlePassXP } = require('../routes/battlepass');
    const bpResult = grantBattlePassXP(u, 'quest_complete', { rarity: quest.rarity || 'common' });
    if (bpResult) u._lastBattlePassXP = bpResult;
  } catch { /* battlepass module not loaded yet */ }
  // ── World Boss damage ──
  try {
    const { dealBossDamage } = require('../routes/world-boss');
    dealBossDamage(userId, quest.rarity || 'common');
  } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.warn('[world-boss] dealBossDamage error:', e.message); }
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
  const lootAmuletBonus = getWorkshopBonus(userId, 'loot_amulet') / 100; // +1-3%
  let dropChance = pityGuaranteed ? 1 : ((hasLuckBuff ? 0.20 : 0.10) + glueckBonus + lootAmuletBonus);
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
  const droppedMaterials = rollCraftingMaterials(quest.rarity || 'common', legendaryMods.materialDoubleChance, u, userId);
  if (droppedMaterials.length > 0) {
    u.craftingMaterials = u.craftingMaterials || {};
    for (const mat of droppedMaterials) {
      u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + mat.amount;
    }
  }
  // ─── Gem drops ──────────────────────────────────────────────────────────────
  const gemsData = state.gemsData || require('../public/data/gems.json');
  if (gemsData.gems && gemsData.gems.length > 0) {
    const dropCfg = gemsData.dropConfig || {};
    const baseChance = dropCfg.baseChance || 0.15;
    const rarityBonus = (dropCfg.questRarityBonus || {})[quest.rarity || 'common'] || 0;
    const prospectorBonus = legendaryMods.prospector || 0;
    const gemDropChance = baseChance + rarityBonus + prospectorBonus;
    if (Math.random() < gemDropChance) {
      // Pick random gem type
      const gemDef = gemsData.gems[Math.floor(Math.random() * gemsData.gems.length)];
      // Determine max tier by player level
      const maxTierByLevel = dropCfg.maxTierByLevel || { '1': 1 };
      let maxTier = 1;
      for (const [lvl, tier] of Object.entries(maxTierByLevel)) {
        if (playerLevel >= parseInt(lvl, 10)) maxTier = Math.max(maxTier, tier);
      }
      const tier = 1 + Math.floor(Math.random() * maxTier);
      const tierDef = gemDef.tiers.find(t => t.tier === tier);
      if (tierDef) {
        const gKey = `${gemDef.id}_${tier}`;
        u.gems = u.gems || {};
        u.gems[gKey] = (u.gems[gKey] || 0) + 1;
        u._lastGemDrop = { key: gKey, name: tierDef.name, gem: gemDef.name, stat: gemDef.stat, tier, icon: gemDef.icon };
      }
    }
  }
  // ─── Recipe drops from quests ──────────────────────────────────────────────
  const questRarity = quest.rarity || 'common';
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
  // Talent: friend_quest_xp_echo — mutual friends get X% of earned XP
  const echoEffect = talentEffects.friend_quest_xp_echo;
  if (echoEffect && xpEarned > 0) {
    const echoPercent = echoEffect.percent || 0.03;
    const echoXp = Math.round(xpEarned * echoPercent);
    if (echoXp > 0 && u.friends && Array.isArray(u.friends)) {
      for (const friendId of u.friends) {
        const friend = state.users[friendId];
        if (!friend) continue;
        // Only mutual friends (if required by talent)
        if (echoEffect.requiresMutualFriend && !(friend.friends || []).includes(userId)) continue;
        // Check if friend also has the echo talent (they receive, they don't need it)
        friend.xp = (friend.xp || 0) + echoXp;
        friend._lastEchoXp = { from: userId, amount: echoXp };
      }
    }
  }

  clearRequestCache(); // release cached talent/legendary computations for this user
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
        rarity: 'common',
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
      fierce:    `${name} challenges you: Complete 3 quests today!`,
      wise:      `${name} recommends: Learn something new today`,
      resilient: `${name} reminds you: Rise stronger after every setback`,
      loyal:     `${name} is waiting for you: Time for your daily routine`,
      clever:    `${name} suggests: Find a more creative approach`,
      strong:    `${name} says: You're stronger than you think. Exercise!`,
    };
    const quest = {
      id: `quest-${Date.now()}-companion`,
      title: msgs[personality] || `${name}: Stay on course!`,
      description: `Your companion ${name} accompanies you on your journey.`,
      rarity: 'common',
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
    else if (cond.type === 'full_equipment') earned = slotsFilled >= 7;
    else if (cond.type === 'gacha_legendary') {
      const gs = state.gachaState[userId];
      const legendaryPulls = (gs?.history || []).filter(h => h.rarity === 'legendary').length;
      earned = legendaryPulls >= cond.value;
    }
    else if (cond.type === 'achievement_points') {
      const achPts = (u.earnedAchievements || []).reduce((sum, a) => sum + (a.points || 0), 0);
      earned = achPts >= cond.value;
    }
    else if (cond.type === 'gear_score') {
      const { gearScore } = getGearScore(userId);
      earned = gearScore >= cond.value;
    }
    else if (cond.type === 'profession_skill') {
      const maxSkill = Math.max(0, ...Object.values(u.professions || {}).map(p => p.skill || 0));
      earned = maxSkill >= cond.value;
    }
    else if (cond.type === 'mythic_cleared') {
      earned = (u.highestMythicCleared || 0) >= cond.value;
    }
    else if (cond.type === 'companions_owned') {
      const compIds = new Set();
      if (u.companion?.type) compIds.add(u.companion.type);
      earned = compIds.size >= cond.value;
    }
    else if (cond.type === 'bond_level') {
      earned = (u.companion?.bondLevel || 0) >= cond.value;
    }
    else if (cond.type === 'rituals_completed') {
      const ritualCount = (state.rituals || []).filter(r => r.playerId === userId && r.lastCompleted).length;
      earned = ritualCount >= cond.value;
    }
    else if (cond.type === 'battlepass_level') {
      earned = (u.battlePass?.level || 0) >= cond.value;
    }
    else if (cond.type === 'shop_purchase') {
      earned = (u.purchases || []).length >= cond.value;
    }
    else if (cond.type === 'hidden') {
      // Hidden titles — never auto-awarded via condition check
      // Must be manually granted by specific game events
      earned = false;
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
  getStreakXpBonus,
  updateUserStreak,
  awardUserGold,
  updateUserForgeTemp,
  getQuestHoardingMalus,
  getXpMultiplier,
  getWorkshopBonus,
  getGoldMultiplier,
  getForgeXpBase,
  getForgeGoldBase,
  getKraftBonus,
  getWeisheitBonus,
  calcDynamicForgeTemp,
  calcRestedXpPool,
  recordUserCompletion,
  getUserGear,
  getUserEquipment,
  getUserStats,
  getStatBreakdown,
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
  getArmorTraitBonus,
  refreshStreakShields,
  checkAndAwardTitles,
  paginate,
  // Affix rolling system
  PRIMARY_STATS,
  MINOR_STATS,
  ALL_STATS,
  rollAffixStats,
  createGearInstance,
  rollSuffix,
  createUniqueInstance,
  trackUniqueInCollection,
  migrateEquipmentSlot,
  migrateUserEquipment,
  rollCraftingMaterials,
  getItemLevel,
  getGearScore,
  INVENTORY_CAP,
  createPlayerLock,
  clearRequestCache,
  getTalentEffects,
};

// ─── Generic per-player lock (prevents concurrent requests for same player) ──
function createPlayerLock(name) {
  const _locks = new Map();
  return {
    acquire(playerId) {
      if (_locks.has(playerId)) return false;
      _locks.set(playerId, true);
      return true;
    },
    release(playerId) {
      _locks.delete(playerId);
    },
    name,
  };
}
