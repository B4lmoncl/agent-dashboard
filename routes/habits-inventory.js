/**
 * Habits, Inventory, Equipment, Stats, Changelog, Character routes.
 */
const router = require('express').Router();
const {
  state, EQUIPMENT_SLOTS, SET_BONUSES, RARITY_ORDER,
  saveUsers, saveHabits, resolveItem, getActiveBuffs,
} = require('../lib/state');
const {
  now, getLevelInfo, getUserStats, getUserEquipment, getUserDropBonus,
  rollLoot, resetLootPity, addLootToInventory, calcDynamicForgeTemp,
  getBondLevel,
} = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');
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

router.post('/api/habits', requireApiKey, (req, res) => {
  const { title, positive, negative, playerId } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  const habit = {
    id: `habit-${Date.now()}`,
    title,
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

router.post('/api/habits/:id/score', requireApiKey, (req, res) => {
  const { direction, playerId } = req.body;
  const habit = state.habits.find(h => h.id === req.params.id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
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
  const uid = (playerId || '').toLowerCase();
  const u = state.users[uid];
  if (u && direction === 'up') {
    u.xp = (u.xp || 0) + 3;
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
  saveHabits();
  res.json({ ok: true, habit, lootDrop });
});

router.delete('/api/habits/:id', requireApiKey, (req, res) => {
  const idx = state.habits.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Habit not found' });
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

router.post('/api/player/:name/inventory/use/:itemId', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const invItem = (u.inventory || []).find(i => i.id === req.params.itemId);
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
    u.inventory = u.inventory.filter(i => i.id !== invItem.id);
    saveUsers();
    return res.json({ ok: true, effect: null, message: 'Item verbraucht.', updatedValues: {} });
  }

  let message = '';
  const updatedValues = {};

  // ─── Effect handlers ───────────────────────────────────────────────
  switch (effectType) {
    case 'gold': {
      const amt = effect.amount || 0;
      u.gold = (u.gold || 0) + amt;
      if (u.currencies) u.currencies.gold = u.gold;
      updatedValues.gold = u.gold;
      message = `+${amt} Gold erhalten!`;
      break;
    }
    case 'xp': {
      const amt = effect.amount || 0;
      u.xp = (u.xp || 0) + amt;
      updatedValues.xp = u.xp;
      message = `+${amt} XP erhalten!`;
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
      message = `XP-Boost aktiv! +${amt}% für ${dur}`;
      break;
    }
    case 'bond': {
      const amt = effect.amount || 1;
      if (u.companion) {
        u.companion.bondXp = (u.companion.bondXp || 0) + amt;
        u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
        updatedValues.bondXp = u.companion.bondXp;
        updatedValues.bondLevel = u.companion.bondLevel;
        message = `+${amt} Bond XP! ${u.companion.name || 'Dein Begleiter'} freut sich!`;
      } else {
        message = `+${amt} Bond XP! (Kein Begleiter aktiv)`;
      }
      break;
    }
    case 'streak_shield': {
      const amt = effect.amount || 1;
      u.streakShields = Math.min(10, (u.streakShields || 0) + amt);
      updatedValues.streakShields = u.streakShields;
      message = `+${amt} Streak-Schutzschild(e) erhalten!`;
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
      message = `Schmiedeglut +${amt}°! Forge-Temperatur steigt!`;
      break;
    }
    case 'random_gear': {
      const { level: playerLvl } = getLevelInfo(u.xp || 0);
      const eligible = state.FULL_GEAR_ITEMS.filter(g => g.minLevel <= playerLvl && !g.shopHidden);
      const pool = eligible.length > 0 ? eligible : state.FULL_GEAR_ITEMS.filter(g => g.minLevel <= playerLvl);
      if (pool.length > 0) {
        const gearItem = pool[Math.floor(Math.random() * pool.length)];
        const newEntry = {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: gearItem.id,
          name: gearItem.name,
          rarity: gearItem.rarity || 'common',
          rarityColor: null,
          obtainedAt: now(),
          resolvedGear: { id: gearItem.id, name: gearItem.name, slot: gearItem.slot, emoji: gearItem.emoji },
        };
        u.inventory.push(newEntry);
        updatedValues.newItem = newEntry;
        message = `Du erhältst: ${gearItem.name}!`;
      } else {
        message = 'Keine passende Ausrüstung gefunden.';
      }
      break;
    }
    case 'random_gear_epic': {
      const { level: playerLvl2 } = getLevelInfo(u.xp || 0);
      const minRarityIdx = RARITY_ORDER.indexOf('epic');
      const eligible2 = state.FULL_GEAR_ITEMS.filter(g =>
        g.minLevel <= playerLvl2 && !g.shopHidden &&
        RARITY_ORDER.indexOf(g.rarity || 'common') >= minRarityIdx
      );
      const pool2 = eligible2.length > 0 ? eligible2 : state.FULL_GEAR_ITEMS.filter(g => g.minLevel <= playerLvl2);
      if (pool2.length > 0) {
        const gearItem = pool2[Math.floor(Math.random() * pool2.length)];
        const newEntry = {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: gearItem.id,
          name: gearItem.name,
          rarity: gearItem.rarity || 'epic',
          rarityColor: null,
          obtainedAt: now(),
          resolvedGear: { id: gearItem.id, name: gearItem.name, slot: gearItem.slot, emoji: gearItem.emoji },
        };
        u.inventory.push(newEntry);
        updatedValues.newItem = newEntry;
        message = `Du erhältst: ${gearItem.name}!`;
      } else {
        message = 'Keine passende Ausrüstung gefunden.';
      }
      break;
    }
    case 'companion_egg': {
      // Future feature — store as pending
      if (!u.pendingEggs) u.pendingEggs = [];
      u.pendingEggs.push({ obtainedAt: now() });
      updatedValues.pendingEggs = u.pendingEggs.length;
      message = 'Ein mysteriöses Ei... (coming soon)';
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
      // Placeholder — complex logic for Task 2
      message = 'Schmiedehammer der Meister aktiviert! (Upgrade-System coming soon)';
      break;
    }
    case 'undo_missed_ritual': {
      // Reset ritual miss counter
      if (u.ritualMissCount !== undefined) {
        u.ritualMissCount = 0;
        updatedValues.ritualMissCount = 0;
      }
      message = 'Zweite Chance! Verpasstes Ritual zurückgesetzt.';
      break;
    }
    case 'named_gear': {
      // Placeholder — would add a specific legendary weapon
      message = 'Legendäre Waffe erhalten! (Coming soon — wird in Task 2 implementiert)';
      break;
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
      message = `Gildensegen aktiv! +${amt}% XP für alle!`;
      break;
    }
    case 'title': {
      const titleName = effect.title || 'Unbekannt';
      if (!u.titles) u.titles = [];
      if (!u.titles.includes(titleName)) u.titles.push(titleName);
      updatedValues.titles = u.titles;
      message = `Neuer Titel freigeschaltet: ${titleName}!`;
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
      message = 'Phoenix-Feder bereit! Nächster Streak-Verlust wird verhindert.';
      break;
    }
    case 'gold_2x_24h': {
      if (!u.activeBuffs) u.activeBuffs = [];
      const activatedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
      u.activeBuffs.push({ type: 'gold_2x', amount: 2, duration: '24h', activatedAt, expiresAt });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = '2x Gold aktiv für 24 Stunden!';
      break;
    }
    case 'essenz_boost_48h': {
      if (!u.activeBuffs) u.activeBuffs = [];
      const activatedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
      u.activeBuffs.push({ type: 'essenz_boost', amount: 2, duration: '48h', activatedAt, expiresAt });
      updatedValues.activeBuffs = getActiveBuffs(uid);
      message = '2x Essenz-Drops aktiv für 48 Stunden!';
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
      message = `+24h auf ${extended} aktive Quest-Timer!`;
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
      message = 'Phoenix-Feder bereit! Nächster Streak-Verlust wird verhindert.';
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
      message = `Schmiedeglut +${amt}°! Forge-Temperatur steigt!`;
      break;
    }
    default: {
      // Unknown effect — consume anyway but note it
      message = `Item verbraucht. (Effekt "${effectType}" wird noch nicht unterstützt)`;
      break;
    }
  }

  // Remove item from inventory (consumable is consumed)
  u.inventory = u.inventory.filter(i => i.id !== invItem.id);
  saveUsers();

  res.json({ ok: true, effect: effect || null, message, updatedValues });
});

// ─── Discard endpoint ──────────────────────────────────────────────────────
router.post('/api/player/:name/inventory/discard/:itemId', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const idx = (u.inventory || []).findIndex(i => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not found in inventory' });

  const discarded = u.inventory.splice(idx, 1)[0];
  saveUsers();

  res.json({ ok: true, discarded });
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
  const item = state.FULL_GEAR_ITEMS.find(g => g.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.get('/api/gear-templates', (req, res) => {
  res.json({ tiers: state.gearTemplates.tiers, setBonus: state.gearTemplates.setBonus });
});

router.post('/api/player/:name/equip/:itemId', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.equipment) u.equipment = {};
  if (!u.inventory) u.inventory = [];
  const { level } = getLevelInfo(u.xp || 0);

  // 1. Check FULL_GEAR_ITEMS (shop buy+equip flow — costs gold)
  const shopItem = state.FULL_GEAR_ITEMS.find(g => g.id === req.params.itemId);
  if (shopItem) {
    if (level < shopItem.minLevel) return res.status(400).json({ error: `Requires level ${shopItem.minLevel}` });
    if ((u.gold || 0) < shopItem.cost) return res.status(400).json({ error: `Insufficient gold. Need ${shopItem.cost}, have ${u.gold || 0}` });
    if (u.equipment[shopItem.slot] === shopItem.id) return res.status(409).json({ error: 'Already equipped' });

    // Swap: return currently equipped item to inventory
    const prevItemId = u.equipment[shopItem.slot];
    if (prevItemId) {
      const prevTemplate = resolveItem(prevItemId);
      u.inventory.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: prevItemId,
        name: prevTemplate?.name || prevItemId,
        emoji: prevTemplate?.emoji || null,
        icon: prevTemplate?.icon || null,
        rarity: prevTemplate?.rarity || 'common',
        stats: prevTemplate?.stats || {},
        obtainedAt: now(),
        source: 'unequip',
      });
    }

    u.gold -= shopItem.cost;
    u.equipment[shopItem.slot] = shopItem.id;
    if (!u.purchases) u.purchases = [];
    u.purchases.push({ type: 'equipment', item: shopItem.id, cost: shopItem.cost, at: now() });
    const stats = getUserStats(uid);
    saveUsers();
    return res.json({ ok: true, equipment: u.equipment, stats, gold: u.gold });
  }

  // 2. Check user.inventory[] for equipment-type items (already owned — no gold cost)
  const invEntry = u.inventory.find(i => i.id === req.params.itemId);
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

  if (u.equipment[slot] === templateId) return res.status(409).json({ error: 'Already equipped' });

  // Swap: return currently equipped item to inventory
  const prevItemId = u.equipment[slot];
  if (prevItemId) {
    const prevTemplate = resolveItem(prevItemId);
    u.inventory.push({
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: prevItemId,
      name: prevTemplate?.name || prevItemId,
      emoji: prevTemplate?.emoji || null,
      icon: prevTemplate?.icon || null,
      rarity: prevTemplate?.rarity || 'common',
      stats: prevTemplate?.stats || {},
      obtainedAt: now(),
      source: 'unequip',
    });
  }

  // Remove from inventory and equip
  u.inventory = u.inventory.filter(i => i.id !== invEntry.id);
  u.equipment[slot] = templateId;

  const stats = getUserStats(uid);
  saveUsers();
  res.json({ ok: true, equipment: u.equipment, stats, gold: u.gold || 0, fromInventory: true });
});

router.get('/api/player/:name/stats', (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const stats = getUserStats(uid);
  const equipment = getUserEquipment(uid);
  res.json({ stats, equipment });
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
    return res.json({ entries: [], error: 'Could not fetch changelog from GitHub' });
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
  const equippedIds = Object.values(u.equipment || {}).filter(Boolean);
  let baseStats = { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equippedItems = [];
  for (const itemId of equippedIds) {
    let item = state.FULL_GEAR_ITEMS.find(g => g.id === itemId);
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
    namedSetBonuses.push({ id: ns.id, name: ns.name, rarity: ns.rarity, count: ownedCount, total: ns.pieces.length, isComplete, activeLabel });
  }
  let classTier = null;
  if (u.classId) {
    const classData = state.store.classes ? state.store.classes.find(c => c.id === u.classId) : null;
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
      const item = state.FULL_GEAR_ITEMS.find(g => g.id === entry);
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
      if (gearRef?.id) gearItem = state.FULL_GEAR_ITEMS.find(g => g.id === gearRef.id);
      if (!gearItem && entry.itemId) gearItem = state.FULL_GEAR_ITEMS.find(g => g.id === entry.itemId);
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
  for (const item of equippedItems) {
    if (!inventoryItems.find(i => i.id === item.id)) {
      const icon = item.icon || gachaIconMap[item.id] || gachaIconMap[item.name] || undefined;
      inventoryItems.push({ id: item.id, slot: item.slot, name: item.name, icon, tier: item.tier, minLevel: item.minLevel, stats: item.stats || {}, rarity: item.rarity || 'common', desc: item.desc || undefined, type: item.type || item.slot || undefined });
    }
  }
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
    xpProgress,
    title: lvlInfo.title,
    classId: u.classId || null,
    classTier,
    classFantasy: u.classId && state.store.classes ? (state.store.classes.find(c => c.id === u.classId)?.fantasy ?? null) : null,
    classIcon: u.classId && state.store.classes ? (state.store.classes.find(c => c.id === u.classId)?.icon ?? null) : null,
    relationshipStatus: u.relationshipStatus || 'single',
    partnerName: u.partnerName || null,
    companion,
    equipment: u.equipment || {},
    stats: { kraft: fullStats.kraft || 0, ausdauer: fullStats.ausdauer || 0, weisheit: fullStats.weisheit || 0, glueck: fullStats.glueck || 0 },
    baseStats,
    inventory: inventoryItems,
    forgeTemp: calcDynamicForgeTemp(uid),
    // season: 'spring', // Season Pass disabled — Coming Soon
    setBonusInfo,
    namedSetBonuses,
  });
});

router.post('/api/player/:name/unequip/:slot', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const slot = req.params.slot;
  if (!EQUIPMENT_SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid slot' });
  if (!u.equipment) u.equipment = {};
  if (!u.inventory) u.inventory = [];

  const itemId = u.equipment[slot];
  if (itemId) {
    // Return the item to inventory
    const template = resolveItem(itemId);
    u.inventory.push({
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: itemId,
      name: template?.name || itemId,
      emoji: template?.emoji || null,
      icon: template?.icon || null,
      rarity: template?.rarity || 'common',
      stats: template?.stats || {},
      obtainedAt: now(),
      source: 'unequip',
    });
  }

  delete u.equipment[slot];
  saveUsers();
  const stats = getUserStats(uid);
  res.json({ ok: true, equipment: u.equipment, stats });
});

module.exports = router;
module.exports.fetchAndCacheChangelog = fetchAndCacheChangelog;
module.exports.CHANGELOG_TTL = CHANGELOG_TTL;
