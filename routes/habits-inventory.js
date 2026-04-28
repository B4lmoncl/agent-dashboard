/**
 * Habits, Inventory, Equipment, Stats, Changelog, Character routes.
 */
const router = require('express').Router();
const {
  state, EQUIPMENT_SLOTS, SET_BONUSES, RARITY_ORDER,
  saveUsers, saveHabits, resolveItem, getActiveBuffs, ensureUserCurrencies,
} = require('../lib/state');
const {
  now, getLevelInfo, getUserStats, getUserEquipment, getUserDropBonus, getStatBreakdown,
  rollLoot, resetLootPity, addLootToInventory, calcDynamicForgeTemp,
  getBondLevel, getLegendaryEffects, createGearInstance, migrateUserEquipment, getGearScore,
  getTodayBerlin, createPlayerLock, INVENTORY_CAP, grantPlayerXp,
} = require('../lib/helpers');
const inventoryLock = createPlayerLock('inventory');
const { requireAuth, requireSelf } = require('../lib/middleware');
const { rebuildCatalogMeta } = require('../lib/quest-catalog');

let changelogCache = null;
let changelogLastFetch = 0;
const CHANGELOG_TTL = 30 * 60 * 1000;

router.get('/api/habits', (req, res) => {
  const { player } = req.query;
  if (player) {
    return res.json(state.habits.filter(h => h.playerId === player.toLowerCase()));
  }
  res.json(state.habits);
});

router.post('/api/habits', requireAuth, (req, res) => {
  const { title, positive, negative, playerId } = req.body;
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required (string)' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  // Auth: non-admin may only create habits for themselves
  if (!req.auth?.isAdmin && req.auth?.userId !== (playerId || '').toLowerCase()) {
    return res.status(403).json({ error: 'Cannot create habits for another player' });
  }
  const safeTitle = String(title).replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 200).trim();
  if (!safeTitle) return res.status(400).json({ error: 'title must be non-empty' });
  const habit = {
    id: `habit-${Date.now()}`,
    title: safeTitle,
    positive: positive !== false,
    negative: negative === true,
    color: 'gray',
    score: 0,
    playerId: playerId.toLowerCase(),
    createdAt: now(),
  };
  state.habits.push(habit);
  saveHabits();
  res.json({ ok: true, habit });
});

router.post('/api/habits/:id/score', requireAuth, (req, res) => {
  const { direction, playerId } = req.body;
  const habit = state.habits.find(h => h.id === req.params.id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  const authId = req.auth?.userId?.toLowerCase() || req.auth?.userName?.toLowerCase();
  if (habit.playerId && habit.playerId.toLowerCase() !== authId) return res.status(403).json({ error: 'Not your habit' });
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction must be up or down' });
  if (direction === 'up') habit.score = (habit.score || 0) + 1;
  else habit.score = (habit.score || 0) - 1;
  const s = habit.score;
  if (s <= -5) habit.color = 'red';
  else if (s <= -2) habit.color = 'orange';
  else if (s === 0) habit.color = 'gray';
  else if (s <= 3) habit.color = 'yellow';
  else if (s <= 8) habit.color = 'green';
  else habit.color = 'blue';
  let lootDrop = null;
  const uid = authId; // Use authenticated user ID, not body param (prevents XP injection)
  const u = state.users[uid];
  if (u && direction === 'up') {
    // Daily gate: XP + loot only on first completion per habit per day
    const today = getTodayBerlin();
    if (!u._habitCompletedToday) u._habitCompletedToday = {};
    const habitKey = req.params.id;
    if (u._habitCompletedToday._date !== today) {
      u._habitCompletedToday = { _date: today }; // Reset daily tracking
    }
    if (!u._habitCompletedToday[habitKey]) {
      u._habitCompletedToday[habitKey] = true;
      const bondLevel = u.companion?.bondLevel ?? 1;
      const bondBonus = 1 + 0.01 * Math.max(0, bondLevel - 1);
      grantPlayerXp(u, Math.round(3 * bondBonus));
      const dropBonus = getUserDropBonus(uid);
      const { level: habitPlayerLevel } = getLevelInfo(u.xp || 0);
      const dropped = rollLoot(0.05 + dropBonus, habitPlayerLevel);
      if (dropped) {
        resetLootPity(uid);
        addLootToInventory(uid, dropped);
        lootDrop = dropped;
      }
      saveUsers();
    }
  }
  saveHabits();
  res.json({ ok: true, habit, lootDrop });
});

router.delete('/api/habits/:id', requireAuth, (req, res) => {
  const idx = state.habits.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Habit not found' });
  const habit = state.habits[idx];
  const authId = req.auth?.userId?.toLowerCase() || req.auth?.userName?.toLowerCase();
  if (habit.playerId && habit.playerId.toLowerCase() !== authId) return res.status(403).json({ error: 'Not your habit' });
  state.habits.splice(idx, 1);
  saveHabits();
  res.json({ ok: true });
});

router.get('/api/player/:name/inventory', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  res.json({ inventory: u.inventory || [], streakShields: u.streakShields || 0 });
});

router.post('/api/player/:name/inventory/use/:itemId', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!inventoryLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const useItemId = req.params.itemId;
  const invItem = (u.inventory || []).find(i => (i.instanceId || i.id) === useItemId);
  if (!invItem) return res.status(404).json({ error: 'Item not found in inventory' });

  // Resolve the full template for this item
  const templateId = invItem.itemId || invItem.id;
  const template = resolveItem(templateId) || resolveItem(invItem.itemId);

  // Determine the effect to apply
  const effect = template?.effect || invItem.effect;
  const itemType = template?.type || invItem.type || 'consumable';

  // Passive items cannot be "used" — they are always active while in inventory
  if (itemType === 'passive') {
    return res.status(400).json({ error: 'Passive items are always active while in inventory and cannot be used.' });
  }

  // Equipment items should be equipped, not "used"
  if (itemType === 'equipment') {
    return res.status(400).json({ error: 'Equipment items must be equipped, not used. Use the equip endpoint.' });
  }

  const effectType = effect?.type || (typeof effect === 'string' ? effect : null);
  if (!effectType) {
    // No effect — just remove the item
    const rmId = invItem.instanceId || invItem.id;
    u.inventory = u.inventory.filter(i => (i.instanceId || i.id) !== rmId);
    saveUsers();
    return res.json({ ok: true, effect: null, message: 'Item consumed.', updatedValues: {} });
  }

  let message = '';
  const updatedValues = {};

  // ─── Effect handlers ───────────────────────────────────────────────
  switch (effectType) {
    case 'gold': {
      const amt = effect.amount || 0;
      ensureUserCurrencies(u);
      u.currencies.gold = (u.currencies.gold ?? u.gold ?? 0) + amt;
      u.gold = u.currencies.gold;
      updatedValues.gold = u.gold;
      message = `+${amt} Gold erhalten`;
      break;
    }
    case 'xp': {
      const amt = effect.amount || 0;
      grantPlayerXp(u, amt);
      updatedValues.xp = u.xp;
      message = `+${amt} XP erhalten`;
      break;
    }
    case 'xp_boost': {
      const amt = effect.amount || 10;
      const dur = effect.duration || '24h';
      if (!u.activeBuffs) u.activeBuffs = [];
      const activatedAt = new Date().toISOString();
      let expiresAt = null;
      if (dur === '24h') expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
      else if (dur === '48h') expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
      // Task-based durations stored as-is, checked elsewhere
      u.activeBuffs.push({ type: 'xp_boost', amount: amt, duration: dur, activatedAt, expiresAt });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `XP Boost active. +${amt}% for ${dur}`;
      break;
    }
    case 'bond': {
      if (!u.companion) return res.status(400).json({ error: 'No companion active — equip a companion first.' });
      const amt = effect.amount || 1;
      u.companion.bondXp = (u.companion.bondXp || 0) + amt;
      u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
      updatedValues.bondXp = u.companion.bondXp;
      updatedValues.bondLevel = u.companion.bondLevel;
      message = `+${amt} Bond XP. ${u.companion.name || 'Your Companion'} appreciates the gesture.`;
      break;
    }
    case 'streak_shield': {
      const amt = effect.amount || 1;
      u.streakShields = Math.min(10, (u.streakShields || 0) + amt);
      updatedValues.streakShields = u.streakShields;
      message = `+${amt} Streak-Schutzschild(e) erhalten`;
      break;
    }
    case 'forge_temp': {
      const amt = effect.amount || 10;
      // Apply pending decay first
      if (u.forgeTempAt) {
        const hrs = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
        u.forgeTemp = Math.max(0, (u.forgeTemp || 0) - hrs * 2);
      }
      u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + amt);
      u.forgeTempAt = new Date().toISOString();
      updatedValues.forgeTemp = u.forgeTemp;
      message = `Schmiedeglut +${amt}°. Forge-Temperatur steigt.`;
      break;
    }
    case 'random_gear': {
      if ((u.inventory || []).length >= INVENTORY_CAP) { message = 'Inventory full'; break; }
      const { level: playerLvl } = getLevelInfo(u.xp || 0);
      const eligible = state.FULL_GEAR_ITEMS.filter(g => (g.reqLevel || g.minLevel || 1) <= playerLvl && !g.shopHidden);
      const pool = eligible.length > 0 ? eligible : state.FULL_GEAR_ITEMS.filter(g => (g.reqLevel || g.minLevel || 1) <= playerLvl);
      if (pool.length > 0) {
        const gearTemplate = pool[Math.floor(Math.random() * pool.length)];
        const instance = createGearInstance(gearTemplate);
        u.inventory.push(instance);
        updatedValues.newItem = instance;
        message = `You received: ${instance.name}`;
      } else {
        message = 'No matching equipment found.';
      }
      break;
    }
    case 'random_gear_epic': {
      if ((u.inventory || []).length >= INVENTORY_CAP) { message = 'Inventory full'; break; }
      const { level: playerLvl2 } = getLevelInfo(u.xp || 0);
      const minRarityIdx = RARITY_ORDER.indexOf('epic');
      const eligible2 = state.FULL_GEAR_ITEMS.filter(g =>
        (g.reqLevel || g.minLevel || 1) <= playerLvl2 && !g.shopHidden &&
        RARITY_ORDER.indexOf(g.rarity || 'common') >= minRarityIdx
      );
      const pool2 = eligible2.length > 0 ? eligible2 : state.FULL_GEAR_ITEMS.filter(g => (g.reqLevel || g.minLevel || 1) <= playerLvl2);
      if (pool2.length > 0) {
        const gearTemplate = pool2[Math.floor(Math.random() * pool2.length)];
        const instance = createGearInstance(gearTemplate);
        u.inventory.push(instance);
        updatedValues.newItem = instance;
        message = `You received: ${instance.name}`;
      } else {
        message = 'No matching equipment found.';
      }
      break;
    }
    case 'companion_egg': {
      // Future feature — store as pending
      if (!u.pendingEggs) u.pendingEggs = [];
      u.pendingEggs.push({ obtainedAt: now() });
      updatedValues.pendingEggs = u.pendingEggs.length;
      message = 'A mysterious egg... (coming soon)';
      break;
    }
    case 'cosmetic': {
      const cosmeticId = effect.cosmetic || effect.name || 'unknown';
      if (!u.cosmetics) u.cosmetics = [];
      if (!u.cosmetics.includes(cosmeticId)) u.cosmetics.push(cosmeticId);
      updatedValues.cosmetics = u.cosmetics;
      message = `Neuer Cosmetic freigeschaltet: ${cosmeticId}!`;
      break;
    }
    case 'gear_next_tier': {
      // Not yet implemented — refund item instead of destroying it
      return res.status(400).json({ error: 'Gear-Upgrade-System ist noch nicht verfügbar. Item bleibt im Inventar.' });
    }
    case 'undo_missed_ritual': {
      // Reset ritual miss counter
      if (u.ritualMissCount !== undefined) {
        u.ritualMissCount = 0;
        updatedValues.ritualMissCount = 0;
      }
      message = 'Second Chance! Missed ritual reset.';
      break;
    }
    case 'named_gear': {
      // Not yet implemented — refund item
      return res.status(400).json({ error: 'Named-Gear-System ist noch nicht verfügbar. Item bleibt im Inventar.' });
    }
    case 'team_buff': {
      const amt = effect.amount || 25;
      const dur = effect.duration || '24h';
      // Store as a global active buff (on the user who activated it)
      if (!u.activeBuffs) u.activeBuffs = [];
      const activatedAt = new Date().toISOString();
      const expiresAt = dur === '24h' ? new Date(Date.now() + 24 * 3600000).toISOString() : new Date(Date.now() + 48 * 3600000).toISOString();
      u.activeBuffs.push({ type: 'team_buff', amount: amt, duration: dur, activatedAt, expiresAt, scope: 'global' });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `Guild Blessing active. +${amt}% XP for all.`;
      break;
    }
    case 'title': {
      const titleName = effect.title || 'Unbekannt';
      if (!u.titles) u.titles = [];
      if (!u.titles.includes(titleName)) u.titles.push(titleName);
      updatedValues.titles = u.titles;
      message = `Neuer Titel freigeschaltet: ${titleName}`;
      break;
    }
    case 'unlock_secret_quest': {
      // Placeholder — would create a secret quest
      message = 'Eine geheime Quest wurde freigeschaltet... (coming soon)';
      break;
    }
    case 'revive': {
      u.phoenixFeather = true;
      updatedValues.phoenixFeather = true;
      message = 'Phoenix Feather ready. Next streak loss prevented.';
      break;
    }
    case 'gold_2x_24h': {
      if (!u.activeBuffs) u.activeBuffs = [];
      const activatedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
      u.activeBuffs.push({ type: 'gold_2x', amount: 2, duration: '24h', activatedAt, expiresAt });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = '2x Gold active for 24 hours.';
      break;
    }
    case 'essenz_boost_48h': {
      if (!u.activeBuffs) u.activeBuffs = [];
      const activatedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
      u.activeBuffs.push({ type: 'essenz_boost', amount: 2, duration: '48h', activatedAt, expiresAt });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = '2x Essence drops active for 48 hours.';
      break;
    }
    case 'quest_timer_24h': {
      // Extend all active quest deadlines by 24h
      let extended = 0;
      for (const q of state.quests) {
        if (q.assignedTo === uid && q.status === 'active' && q.deadline) {
          q.deadline = new Date(new Date(q.deadline).getTime() + 24 * 3600000).toISOString();
          extended++;
        }
      }
      updatedValues.questsExtended = extended;
      message = `+24h on ${extended} active quest timers`;
      break;
    }
    // Gacha passive effect strings used as consumable (when someone manages to "use" them)
    case 'small_heal': {
      // +10 forge temp
      if (u.forgeTempAt) {
        const hrs = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
        u.forgeTemp = Math.max(0, (u.forgeTemp || 0) - hrs * 2);
      }
      u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + 10);
      u.forgeTempAt = new Date().toISOString();
      updatedValues.forgeTemp = u.forgeTemp;
      message = 'Heiltrank getrunken! +10 Forge-Temperatur.';
      break;
    }
    case 'streak_recovery_100': {
      u.phoenixFeather = true;
      updatedValues.phoenixFeather = true;
      message = 'Phoenix Feather ready. Next streak loss prevented.';
      break;
    }
    case 'armor': {
      // Backward compat: old loot items had "armor" effect — treat as forge_temp
      const amt = effect.amount || 5;
      if (u.forgeTempAt) {
        const hrs = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
        u.forgeTemp = Math.max(0, (u.forgeTemp || 0) - hrs * 2);
      }
      u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + amt);
      u.forgeTempAt = new Date().toISOString();
      updatedValues.forgeTemp = u.forgeTemp;
      message = `Schmiedeglut +${amt}°. Forge-Temperatur steigt.`;
      break;
    }
    case 'essenz': {
      const amt = effect.amount || 50;
      if (!u.currencies) u.currencies = {};
      u.currencies.essenz = (u.currencies.essenz || 0) + amt;
      updatedValues.essenz = u.currencies.essenz;
      message = `+${amt} Essenz!`;
      break;
    }
    case 'stardust': {
      const amt = effect.amount || 25;
      if (!u.currencies) u.currencies = {};
      u.currencies.stardust = (u.currencies.stardust || 0) + amt;
      updatedValues.stardust = u.currencies.stardust;
      message = `+${amt} Stardust!`;
      break;
    }
    case 'runensplitter': {
      const amt = effect.amount || 10;
      if (!u.currencies) u.currencies = {};
      u.currencies.runensplitter = (u.currencies.runensplitter || 0) + amt;
      updatedValues.runensplitter = u.currencies.runensplitter;
      message = `+${amt} Runensplitter!`;
      break;
    }
    case 'sternentaler': {
      const amt = effect.amount || 5;
      if (!u.currencies) u.currencies = {};
      u.currencies.sternentaler = (u.currencies.sternentaler || 0) + amt;
      updatedValues.sternentaler = u.currencies.sternentaler;
      message = `+${amt} Sternentaler!`;
      break;
    }
    case 'xp_gold_boost': {
      if (!u.activeBuffs) u.activeBuffs = [];
      const charges = effect.charges || 5;
      u.activeBuffs.push({ type: 'xp_gold_boost', xpPercent: effect.xpPercent || 15, goldPercent: effect.goldPercent || 10, chargesRemaining: charges, activatedAt: new Date().toISOString() });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `+${effect.xpPercent || 15}% XP & +${effect.goldPercent || 10}% Gold for ${charges} quests!`;
      break;
    }
    case 'luck_boost': {
      if (!u.activeBuffs) u.activeBuffs = [];
      const charges = effect.charges || 3;
      u.activeBuffs.push({ type: 'luck_boost', percent: effect.percent || 20, chargesRemaining: charges, activatedAt: new Date().toISOString() });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `+${effect.percent || 20}% Drop Chance for ${charges} quests!`;
      break;
    }
    case 'faction_rep': {
      const amt = effect.amount || 50;
      if (!u.factionRepBonus) u.factionRepBonus = 0;
      u.factionRepBonus += amt;
      updatedValues.factionRepBonus = u.factionRepBonus;
      message = `+${amt} Faction Reputation Bonus!`;
      break;
    }
    case 'craft_discount': {
      if (!u.activeBuffs) u.activeBuffs = [];
      u.activeBuffs.push({ type: 'craft_discount', percent: effect.percent || 50, chargesRemaining: effect.charges || 1, activatedAt: new Date().toISOString() });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `Next crafting costs ${effect.percent || 50}% less Gold!`;
      break;
    }
    case 'expedition_speed': {
      if (!u.activeBuffs) u.activeBuffs = [];
      u.activeBuffs.push({ type: 'expedition_speed', percent: effect.percent || 25, chargesRemaining: effect.charges || 1, activatedAt: new Date().toISOString() });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `Next companion expedition ${effect.percent || 25}% faster!`;
      break;
    }
    case 'dungeon_reset': {
      if (!u.activeBuffs) u.activeBuffs = [];
      u.activeBuffs.push({ type: 'dungeon_reset', chargesRemaining: effect.charges || 1, activatedAt: new Date().toISOString() });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = 'Dungeon cooldown reset available!';
      break;
    }
    case 'rift_time_extend': {
      if (!u.activeBuffs) u.activeBuffs = [];
      u.activeBuffs.push({ type: 'rift_time_extend', percent: effect.percent || 25, chargesRemaining: effect.charges || 1, activatedAt: new Date().toISOString() });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = `Next rift +${effect.percent || 25}% time!`;
      break;
    }
    case 'multi_reward': {
      const xp = effect.xp || 0;
      const gold = effect.gold || 0;
      const essenz = effect.essenz || 0;
      grantPlayerXp(u, xp);
      ensureUserCurrencies(u);
      u.currencies.gold = (u.currencies.gold ?? u.gold ?? 0) + gold;
      u.gold = u.currencies.gold;
      u.currencies.essenz = (u.currencies.essenz || 0) + essenz;
      updatedValues.xp = u.xp;
      updatedValues.gold = u.gold;
      updatedValues.essenz = u.currencies.essenz;
      message = `+${xp} XP, +${gold} Gold, +${essenz} Essenz!`;
      break;
    }
    case 'vellum': {
      // Enchant Vellum — apply stat buff from vellumEffect
      const ve = invItem.vellumEffect;
      if (!ve || !ve.stat || !ve.value) {
        message = 'Invalid vellum — no effect data.';
        break;
      }
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({
        type: `enchant_${ve.stat}`,
        stat: ve.stat,
        value: ve.value,
        expiresAt: new Date(Date.now() + (ve.durationHours || 24) * 3600000).toISOString(),
        activatedAt: now(),
      });
      message = `Enchant applied: +${ve.value} ${ve.stat} for ${ve.durationHours || 24}h!`;
      break;
    }
    case 'gold_boost_next': {
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({ type: 'gold_boost_10', questsRemaining: 1, activatedAt: now() });
      message = 'Gold Boost aktiv! Nächste Quest gibt +10% Gold.';
      break;
    }
    case 'pity_minus_5': {
      // Per-banner pity: boost all active banners' pity by +5
      const { getPlayerGachaState } = require('./gacha');
      if (getPlayerGachaState) {
        const gs = getPlayerGachaState(uid);
        const bannerIds = Object.keys(gs.perBanner || {});
        if (bannerIds.length > 0) {
          for (const bid of bannerIds) {
            gs.perBanner[bid].pity = Math.max(0, (gs.perBanner[bid].pity || 0) + 5);
          }
          const highest = Math.max(...bannerIds.map(b => gs.perBanner[b].pity));
          message = `Pity +5 on ${bannerIds.length} banner${bannerIds.length > 1 ? 's' : ''}! Highest: ${highest}/75.`;
        } else {
          gs.pityCounter = Math.max(0, (gs.pityCounter || 0) + 5);
          message = `Pity +5! Pull on a banner to activate. (${gs.pityCounter}/75)`;
        }
      } else {
        message = 'Gacha system not available.';
      }
      break;
    }
    case 'rarity_boost_15': {
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({ type: 'rarity_boost_15', questsRemaining: 3, activatedAt: now() });
      message = 'Rarity Boost aktiv! +15% Chance auf seltene Drops für 3 Quests.';
      break;
    }
    case 'streak_recovery_50': {
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({ type: 'streak_recovery_50', questsRemaining: 1, activatedAt: now() });
      message = 'Streak-Rettung bereit! 50% Chance, deinen Streak zu retten falls du ihn verlierst.';
      break;
    }
    case 'unlock_secret_quest': {
      // Not yet implemented — refund item
      return res.status(400).json({ error: 'Secret-Quest-System ist noch nicht verfügbar. Item bleibt im Inventar.' });
    }
    case 'team_buff': {
      // Not yet implemented — refund item
      return res.status(400).json({ error: 'Team-Buff-System ist noch nicht verfügbar. Item bleibt im Inventar.' });
    }
    default: {
      // Unknown effect — do NOT consume, return error
      return res.status(400).json({ error: `Effekt "${effectType}" ist nicht implementiert. Item bleibt im Inventar.` });
    }
  }

  // Remove item from inventory (consumable is consumed)
  // Use the same ID that was used for lookup (instanceId takes priority over id)
  const removeId = invItem.instanceId || invItem.id;
  u.inventory = u.inventory.filter(i => (i.instanceId || i.id) !== removeId);
  saveUsers();
  // Some effects modify quests (e.g., quest_timer_24h) — persist those too
  if (updatedValues.questsExtended) {
    const { saveQuests } = require('../lib/state');
    saveQuests();
  }

  res.json({ ok: true, effect: effect || null, message, updatedValues });
  } finally { inventoryLock.release(uid); }
});

// ─── Reorder inventory ────────────────────────────────────────────────────
router.post('/api/player/:name/inventory/reorder', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of item IDs' });

  const inv = u.inventory || [];
  const byId = new Map(inv.map(i => [i.id, i]));
  const reordered = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      reordered.push(item);
      byId.delete(id);
    }
  }
  // Append any items not in the order array (safety)
  for (const item of byId.values()) reordered.push(item);
  u.inventory = reordered;
  saveUsers();

  res.json({ ok: true });
});

// ─── Discard endpoint ──────────────────────────────────────────────────────
// POST /api/player/:name/inventory/lock/:itemId — toggle item lock
router.post('/api/player/:name/inventory/lock/:itemId', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const lockItemId = req.params.itemId;
  const item = (u.inventory || []).find(i => (i.instanceId || i.id) === lockItemId);
  if (!item) return res.status(404).json({ error: 'Item not found in inventory' });
  item.locked = !item.locked;
  saveUsers();
  res.json({ ok: true, locked: item.locked, itemId: item.instanceId || item.id });
});

router.post('/api/player/:name/inventory/discard/:itemId', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!inventoryLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const itemId = req.params.itemId;
  const idx = (u.inventory || []).findIndex(i => (i.instanceId || i.id) === itemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not found in inventory' });
  if (u.inventory[idx].locked) return res.status(400).json({ error: 'Item is locked — unlock it first' });
  // Cannot discard equipped items
  const equippedIds = new Set();
  for (const v of Object.values(u.equipment || {})) {
    if (v && typeof v === 'object' && v.instanceId) equippedIds.add(v.instanceId);
  }
  if (equippedIds.has(u.inventory[idx].instanceId)) return res.status(400).json({ error: 'Unequip the item first' });

  const discarded = u.inventory.splice(idx, 1)[0];
  saveUsers();

  res.json({ ok: true, discarded });
  } finally { inventoryLock.release(uid); }
});

router.get('/api/shop/equipment', (req, res) => {
  const { player, level: levelParam, includeHidden } = req.query;
  const showHidden = includeHidden === '1';
  let items = state.FULL_GEAR_ITEMS.filter(g => showHidden || !g.shopHidden);
  if (levelParam) {
    const lvl = parseInt(levelParam, 10) || 1;
    return res.json(items.filter(g => g.minLevel <= lvl));
  }
  if (player) {
    const u = state.users[player.toLowerCase()];
    const playerXp = u ? (u.xp || 0) : 0;
    const { level } = getLevelInfo(playerXp);
    return res.json(items.filter(g => g.minLevel <= level));
  }
  res.json(items);
});

router.get('/api/gear/:id', (req, res) => {
  const item = state.gearById.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.get('/api/gear-templates', (req, res) => {
  res.json({ tiers: state.gearTemplates.tiers, setBonus: state.gearTemplates.setBonus });
});

router.post('/api/player/:name/equip/:itemId', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!inventoryLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.equipment) u.equipment = {};
  if (!u.inventory) u.inventory = [];
  const { level } = getLevelInfo(u.xp || 0);

  // 1. Check FULL_GEAR_ITEMS (shop buy+equip flow — costs gold)
  const shopItem = state.gearById.get(req.params.itemId);
  if (shopItem) {
    if (level < shopItem.minLevel) return res.status(400).json({ error: `Requires level ${shopItem.minLevel}` });
    // u.currencies.gold is source of truth — u.gold can be stale if another
    // route wrote only to currencies. Matches the fix in shop.js wave 73.
    ensureUserCurrencies(u);
    const goldBalance = u.currencies.gold ?? 0;
    if (goldBalance < shopItem.cost) return res.status(400).json({ error: `Insufficient gold. Need ${shopItem.cost}, have ${goldBalance}` });
    // Check if same template already equipped in that slot
    const currentSlotItem = u.equipment[shopItem.slot];
    if (currentSlotItem && typeof currentSlotItem === 'object' && currentSlotItem.templateId === shopItem.id) {
      return res.status(409).json({ error: 'Already equipped' });
    }

    // Swap: return currently equipped item to inventory
    if (currentSlotItem) {
      const prev = typeof currentSlotItem === 'object' ? currentSlotItem : null;
      u.inventory.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...(prev || { itemId: currentSlotItem, name: currentSlotItem }),
        obtainedAt: now(),
        source: 'unequip',
      });
    }

    const cost = Number(shopItem.cost) || 0;
    if (!isFinite(cost) || cost < 0) return res.status(400).json({ error: 'Invalid cost' });
    u.currencies.gold = goldBalance - cost;
    u.gold = u.currencies.gold;
    // Roll stats for the new item
    const instance = createGearInstance(shopItem);
    // BoE items become bound on equip
    if (instance.binding === 'boe') instance.bound = true;
    u.equipment[shopItem.slot] = instance;
    if (!u.purchases) u.purchases = [];
    u.purchases.push({ type: 'equipment', item: shopItem.id, cost: shopItem.cost, at: now() });
    const stats = getUserStats(uid);
    const legendaryEffects = getLegendaryEffects(uid);
    saveUsers();
    return res.json({ ok: true, equipment: u.equipment, stats, legendaryEffects, gold: u.gold, rolledItem: instance });
  }

  // 2. Check user.inventory[] for equipment-type items (already owned — no gold cost)
  const equipItemId = req.params.itemId;
  const invEntry = u.inventory.find(i => (i.instanceId || i.id) === equipItemId);
  if (!invEntry) return res.status(404).json({ error: 'Gear item not found' });

  const templateId = invEntry.itemId || invEntry.id;
  const template = resolveItem(templateId);
  if (!template || template.type !== 'equipment') {
    return res.status(400).json({ error: 'Item is not equipment' });
  }

  const minLevel = template.minLevel || 1;
  if (level < minLevel) return res.status(400).json({ error: `Requires level ${minLevel}` });

  const slot = template.slot;
  if (!slot) return res.status(400).json({ error: 'Item has no equipment slot' });

  // Check if already equipped in ANY slot (prevents cross-slot duplication)
  const equipId = invEntry.instanceId || invEntry.id;
  for (const [eqSlot, eqItem] of Object.entries(u.equipment || {})) {
    if (eqItem && typeof eqItem === 'object' && (eqItem.instanceId === equipId || eqItem.id === equipId)) {
      return res.status(409).json({ error: `Already equipped in ${eqSlot}` });
    }
  }
  const currentSlotItem = u.equipment[slot];

  // Swap: return currently equipped item to inventory
  if (currentSlotItem) {
    const prev = typeof currentSlotItem === 'object' ? currentSlotItem : null;
    u.inventory.push({
      id: prev?.instanceId || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...(prev || { itemId: currentSlotItem, name: currentSlotItem }),
      obtainedAt: now(),
      source: 'unequip',
    });
  }

  // Remove from inventory and equip as instance
  const removeId = invEntry.instanceId || invEntry.id;
  u.inventory = u.inventory.filter(i => (i.instanceId || i.id) !== removeId);
  // If invEntry already has rolled stats (from gacha/drop), build instance from it
  const instance = {
    instanceId: invEntry.id || `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId,
    name: invEntry.name || template.name,
    slot,
    tier: template.tier || invEntry.tier || 0,
    rarity: invEntry.rarity || template.rarity || 'common',
    stats: invEntry.stats || template.stats || {},
    legendaryEffect: invEntry.legendaryEffect || template.legendaryEffect || null,
    setId: template.setId || invEntry.setId || null,
    desc: invEntry.desc || template.desc || '',
    icon: invEntry.icon || template.icon || null,
    passiveEffect: invEntry.passiveEffect || template.passiveEffect || null,
    passiveDesc: invEntry.passiveDesc || template.passiveDesc || null,
    affixes: invEntry.affixes || template.affixes || null,
    binding: invEntry.binding || template.binding || null,
    bound: invEntry.bound || (invEntry.binding === 'bop') || false,
    locked: invEntry.locked || false,
    rolledAt: invEntry.rolledAt || invEntry.obtainedAt || now(),
  };
  // BoE items become bound on equip
  if (instance.binding === 'boe') instance.bound = true;
  u.equipment[slot] = instance;

  const stats = getUserStats(uid);
  const legendaryEffects = getLegendaryEffects(uid);
  saveUsers();
  res.json({ ok: true, equipment: u.equipment, stats, legendaryEffects, gold: u.gold || 0, fromInventory: true });
  } finally { inventoryLock.release(uid); }
});

router.get('/api/player/:name/stats', (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const stats = getUserStats(uid);
  const equipment = getUserEquipment(uid);
  const { getStatBreakdown } = require('../lib/helpers');
  const breakdown = getStatBreakdown(uid);
  res.json({ stats, equipment, breakdown });
});

router.get('/api/stats/content', (req, res) => {
  rebuildCatalogMeta();
  const totalQuests = state.quests.length;
  const byType = {};
  for (const q of state.quests) {
    const t = q.type || 'development';
    byType[t] = (byType[t] || 0) + 1;
  }
  const totalPlayers = Object.keys(state.users).length;
  const totalCampaigns = state.campaigns.length;
  const totalClasses = state.classesData.classes.length;
  const activeClasses = state.classesData.classes.filter(c => c.status === 'active').length;
  const pendingClasses = state.classesData.classes.filter(c => c.status === 'pending').length;
  const questsPerClass = {};
  for (const q of state.quests) {
    if (q.skills) for (const s of q.skills) {
      questsPerClass[s] = (questsPerClass[s] || 0) + 1;
    }
  }
  const classCounts = Object.values(questsPerClass);
  const balanceCheck = classCounts.length > 0
    ? { min: Math.min(...classCounts), max: Math.max(...classCounts) }
    : { min: 0, max: 0 };
  res.json({
    totalQuests, byType, totalPlayers, totalCampaigns, totalClasses,
    activeClasses, pendingClasses,
    catalogTemplates: state.questCatalog.meta.totalTemplates,
    catalogByCategory: state.questCatalog.meta.byCategory,
    balanceCheck,
  });
});

async function fetchAndCacheChangelog() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/B4lmoncl/agent-dashboard/commits?per_page=50',
      { headers: { 'User-Agent': 'agent-dashboard-server', 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) { console.warn('[changelog] GitHub API returned', res.status); return; }
    const commits = await res.json();
    if (!Array.isArray(commits)) return;
    const byDate = {};
    for (const c of commits) {
      const date = c.commit?.author?.date ? c.commit.author.date.slice(0, 10) : null;
      if (!date) continue;
      const msg = c.commit?.message?.split('\n')[0] || '';
      let type = 'chore';
      let message = msg;
      if (msg.startsWith('feat:')) { type = 'feat'; message = msg.slice(5).trim(); }
      else if (msg.startsWith('fix:')) { type = 'fix'; message = msg.slice(4).trim(); }
      else if (msg.startsWith('chore:')) { type = 'chore'; message = msg.slice(6).trim(); }
      else if (msg.startsWith('docs:')) { type = 'docs'; message = msg.slice(5).trim(); }
      else if (msg.startsWith('refactor:')) { type = 'refactor'; message = msg.slice(9).trim(); }
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({
        sha: c.sha ? c.sha.slice(0, 7) : '',
        type, message,
        author: c.commit?.author?.name || c.author?.login || '',
        url: c.html_url || null,
      });
    }
    const entries = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, commits]) => ({ date, commits }));
    changelogCache = { entries, fetchedAt: new Date().toISOString() };
    changelogLastFetch = Date.now();
    console.log(`[changelog] Cached ${commits.length} commits across ${entries.length} days`);
  } catch (err) { console.warn('[changelog] Failed to fetch from GitHub:', err.message); }
}

router.get('/api/changelog', async (req, res) => {
  if (!changelogCache || Date.now() - changelogLastFetch > CHANGELOG_TTL) {
    await fetchAndCacheChangelog();
  }
  if (!changelogCache) {
    // GitHub fetch failed — signal upstream failure so the client can retry.
    return res.status(502).json({ entries: [], error: 'Could not fetch changelog from GitHub' });
  }
  res.json(changelogCache);
});

router.get('/api/player/:name/character', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const xp = u.xp || 0;
  const lvlInfo = getLevelInfo(xp);
  const xpProgress = lvlInfo.nextXp
    ? Math.min(1, (xp - lvlInfo.xpRequired) / (lvlInfo.nextXp - lvlInfo.xpRequired))
    : 1;
  const equippedRaw = Object.values(u.equipment || {}).filter(Boolean);
  let baseStats = { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equippedItems = [];
  for (const entry of equippedRaw) {
    // entry can be an instance object (new format) or a string ID (legacy)
    if (typeof entry === 'object' && entry.templateId) {
      equippedItems.push({ id: entry.templateId, instanceId: entry.instanceId, name: entry.name, stats: entry.stats || {}, slot: entry.slot, rarity: entry.rarity, setId: entry.setId || null, icon: entry.icon, tier: entry.tier || 0, minLevel: entry.minLevel || 1, desc: entry.desc, legendaryEffect: entry.legendaryEffect || null, passiveEffect: entry.passiveEffect || null, passiveDesc: entry.passiveDesc || null, affixes: entry.affixes || null });
      for (const [stat, val] of Object.entries(entry.stats || {})) {
        baseStats[stat] = (baseStats[stat] || 0) + val;
      }
      continue;
    }
    const itemId = typeof entry === 'string' ? entry : entry.id;
    let item = state.gearById.get(itemId);
    if (!item) {
      // Check item templates for gacha/loot equipment
      const tmpl = resolveItem(itemId);
      if (tmpl && tmpl.type === 'equipment') {
        item = { id: tmpl.id, name: tmpl.name, stats: tmpl.stats || {}, slot: tmpl.slot, rarity: tmpl.rarity, setId: tmpl.setId || null, icon: tmpl.icon, tier: 0, minLevel: tmpl.minLevel || 1, desc: tmpl.description || tmpl.desc };
      }
    }
    if (item) {
      equippedItems.push(item);
      for (const [stat, val] of Object.entries(item.stats)) {
        baseStats[stat] = (baseStats[stat] || 0) + val;
      }
    }
  }
  const fullStats = getUserStats(uid);
  let setBonusInfo = null;
  const setCount = {};
  for (const item of equippedItems) {
    setCount[item.setId] = (setCount[item.setId] || 0) + 1;
  }
  for (const [setId, count] of Object.entries(setCount)) {
    const sb = SET_BONUSES[setId];
    if (sb && count >= 3) {
      setBonusInfo = { name: sb.name, count, total: 6 };
      break;
    }
  }
  const equippedItemIds = new Set(equippedItems.map(i => i.id));
  const namedSetBonuses = [];
  for (const ns of state.gearTemplates.namedSets || []) {
    const ownedCount = ns.pieces.filter(pid => equippedItemIds.has(pid)).length;
    if (ownedCount === 0) continue;
    const isComplete = ownedCount >= ns.pieces.length;
    let activeLabel = null;
    if (isComplete && ns.fullBonus) activeLabel = ns.fullBonus.label;
    else if (ns.partialBonus) {
      for (const [threshold, bonus] of Object.entries(ns.partialBonus)) {
        if (ownedCount >= Number(threshold)) activeLabel = bonus.label;
      }
    }
    // Build all bonus thresholds for active/inactive display
    const bonuses = [];
    if (ns.partialBonus) {
      for (const [threshold, bonus] of Object.entries(ns.partialBonus)) {
        bonuses.push({ threshold: Number(threshold), label: bonus.label, active: ownedCount >= Number(threshold) });
      }
    }
    if (ns.fullBonus) {
      bonuses.push({ threshold: ns.pieces.length, label: ns.fullBonus.label, active: isComplete });
    }
    // Per-piece details for set tracker
    const pieceDetails = ns.pieces.map(pid => {
      const tmpl = state.gearById.get(pid);
      return {
        id: pid,
        name: tmpl?.name || pid,
        slot: tmpl?.slot || "unknown",
        equipped: equippedItemIds.has(pid),
      };
    });
    namedSetBonuses.push({ id: ns.id, name: ns.name, rarity: ns.rarity, count: ownedCount, total: ns.pieces.length, isComplete, activeLabel, bonuses, pieces: pieceDetails });
  }
  let classTier = null;
  if (u.classId) {
    const classData = state.classesData?.classes ? state.classesData?.classes.find(c => c.id === u.classId) : null;
    if (classData && classData.tiers) {
      const tier = [...classData.tiers].reverse().find(t => xp >= t.minXp);
      if (tier) classTier = tier.title;
    }
  }
  // Build icon lookup from gachaPool for backfilling old items missing icons
  const gachaIconMap = {};
  for (const pool of [state.gachaPool.standardPool, state.gachaPool.featuredPool]) {
    for (const gi of (pool || [])) {
      if (gi.icon) {
        if (gi.id) gachaIconMap[gi.id] = gi.icon;
        if (gi.name) gachaIconMap[gi.name] = gi.icon;
      }
    }
  }

  const rawInventory = u.inventory || [];
  const inventoryItems = rawInventory.map(entry => {
    // Entry can be a string ID (gear from FULL_GEAR_ITEMS) or a full loot object
    if (typeof entry === 'string') {
      const item = state.gearById.get(entry);
      if (!item) return null;
      return { id: item.id, slot: item.slot, name: item.name, icon: item.icon || gachaIconMap[item.id] || gachaIconMap[item.name] || undefined, tier: item.tier, minLevel: item.minLevel, stats: item.stats || {}, rarity: item.rarity || 'common', desc: item.desc || undefined, type: item.type || item.slot || undefined };
    }
    // Full loot object from addLootToInventory
    if (entry && typeof entry === 'object') {
      // Try to backfill icon from gachaPool or FULL_GEAR_ITEMS
      let icon = entry.icon;
      if (!icon && entry.itemId) icon = gachaIconMap[entry.itemId];
      if (!icon && entry.name) icon = gachaIconMap[entry.name];
      // Check if it has resolvedGear referencing a FULL_GEAR_ITEMS entry
      const gearRef = entry.resolvedGear;
      let gearItem = null;
      if (gearRef?.id) gearItem = state.gearById.get(gearRef.id);
      if (!gearItem && entry.itemId) gearItem = state.gearById.get(entry.itemId);
      if (gearItem) {
        if (!icon) icon = gearItem.icon || gachaIconMap[gearItem.id] || gachaIconMap[gearItem.name];
        return { id: entry.id, slot: gearItem.slot, name: gearItem.name, icon: icon || undefined, tier: gearItem.tier, minLevel: gearItem.minLevel, stats: gearItem.stats || {}, rarity: entry.rarity || gearItem.rarity || 'common', desc: gearItem.desc || entry.desc || undefined, type: gearItem.type || gearItem.slot || undefined };
      }
      // Try resolving from itemTemplates for enriched data
      const templateId = entry.itemId || entry.id;
      const tmpl = resolveItem(templateId);
      if (tmpl) {
        if (!icon) icon = tmpl.icon;
        const itemType = tmpl.type || entry.type || 'consumable';
        return {
          id: entry.id, slot: tmpl.slot || itemType, name: tmpl.name || entry.name || 'Unknown',
          icon: icon || undefined, tier: tmpl.tier || 0, minLevel: tmpl.minLevel || 0,
          stats: tmpl.stats || entry.stats || {}, rarity: entry.rarity || tmpl.rarity || 'common',
          desc: tmpl.description || tmpl.desc || entry.desc || undefined,
          flavorText: tmpl.flavorText || undefined,
          type: itemType, effect: tmpl.effect || entry.effect || undefined,
        };
      }
      // Pure loot item (consumable, etc.) — no gear reference, no template
      return { id: entry.id, slot: entry.type || 'consumable', name: entry.name || 'Unknown', icon: icon || undefined, tier: 0, minLevel: 0, stats: entry.stats || {}, rarity: entry.rarity || 'common', desc: entry.desc || undefined, type: entry.type || 'consumable', effect: entry.effect || undefined };
    }
    return null;
  }).filter(Boolean);
  // Note: equipped items are NOT added to inventory — they're displayed separately
  // in the Paper Doll equipment slots. Adding them to inventory caused duplicates.
  const companion = u.companion ? {
    type: u.companion.type,
    name: u.companion.name,
    emoji: u.companion.emoji,
    bondLevel: u.companion.bondLevel || 0,
    bondXp: u.companion.bondXp || 0,
  } : null;
  res.json({
    name: u.name || uid,
    level: lvlInfo.level,
    xp,
    xpToNext: lvlInfo.nextXp,
    xpInLevel: lvlInfo.nextXp ? xp - lvlInfo.xpRequired : 0,
    xpForLevel: lvlInfo.nextXp ? lvlInfo.nextXp - lvlInfo.xpRequired : 0,
    xpProgress,
    title: lvlInfo.title,
    classId: u.classId || null,
    classTier,
    classFantasy: u.classId && state.classesData?.classes ? (state.classesData?.classes.find(c => c.id === u.classId)?.fantasy ?? null) : null,
    classIcon: u.classId && state.classesData?.classes ? (state.classesData?.classes.find(c => c.id === u.classId)?.icon ?? null) : null,
    relationshipStatus: u.relationshipStatus || 'single',
    partnerName: u.partnerName || null,
    companion,
    equipment: u.equipment || {},
    stats: {
      kraft: fullStats.kraft || 0, ausdauer: fullStats.ausdauer || 0, weisheit: fullStats.weisheit || 0, glueck: fullStats.glueck || 0,
      fokus: fullStats.fokus || 0, vitalitaet: fullStats.vitalitaet || 0, charisma: fullStats.charisma || 0, tempo: fullStats.tempo || 0,
    },
    baseStats,
    inventory: inventoryItems,
    forgeTemp: calcDynamicForgeTemp(uid),
    // season: 'spring', // Season Pass disabled — Coming Soon
    setBonusInfo,
    namedSetBonuses,
    legendaryEffects: getLegendaryEffects(uid),
    gearScore: getGearScore(uid),
    equippedTitle: u.equippedTitle || null,
    earnedTitleCount: (u.earnedTitles || []).length,
    statBreakdown: getStatBreakdown(uid),
    craftingMaterials: u.craftingMaterials || {},
    materialDefs: state.professionsData?.materials || [],
  });
});

router.post('/api/player/:name/unequip/:slot', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!inventoryLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const slot = req.params.slot;
  if (!EQUIPMENT_SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid slot' });
  if (!u.equipment) u.equipment = {};
  if (!u.inventory) u.inventory = [];

  const equipped = u.equipment[slot];
  if (equipped) {
    // Return the item to inventory (preserve rolled instance data)
    if (typeof equipped === 'object' && equipped.instanceId) {
      u.inventory.push({ ...equipped, id: equipped.instanceId, obtainedAt: now(), source: 'unequip' });
    } else if (typeof equipped === 'string') {
      const template = resolveItem(equipped);
      u.inventory.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: equipped,
        name: template?.name || equipped,
        emoji: template?.emoji || null,
        icon: template?.icon || null,
        rarity: template?.rarity || 'common',
        stats: template?.stats || {},
        obtainedAt: now(),
        source: 'unequip',
      });
    }
  }

  delete u.equipment[slot];
  saveUsers();
  const stats = getUserStats(uid);
  const legendaryEffects = getLegendaryEffects(uid);
  res.json({ ok: true, equipment: u.equipment, stats, legendaryEffects });
  } finally { inventoryLock.release(uid); }
});

module.exports = router;
module.exports.fetchAndCacheChangelog = fetchAndCacheChangelog;
module.exports.CHANGELOG_TTL = CHANGELOG_TTL;
