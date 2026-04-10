/**
 * Living Codex Routes — Lore discovery system.
 * Players unlock codex entries by reaching milestones (levels, professions, bonds, etc.)
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, saveUsers } = require('../lib/state');
const { getLevelInfo } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

let CODEX_DATA = { categories: [], entries: [] };

function loadCodex() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../public/data/codex.json'), 'utf-8');
    CODEX_DATA = JSON.parse(raw);
    console.log(`[codex] Loaded ${CODEX_DATA.entries.length} codex entries`);
  } catch (e) {
    console.warn('[codex] Failed to load codex.json:', e.message);
  }
}

/**
 * Check which codex entries a player has unlocked based on their progress.
 * Returns array of newly discovered entry IDs.
 */
function checkCodexDiscovery(userId) {
  const u = state.users[userId];
  if (!u) return [];
  if (!u.codexDiscovered) u.codexDiscovered = [];
  const discovered = new Set(u.codexDiscovered);
  const newEntries = [];
  const level = getLevelInfo(u.xp || 0).level;

  for (const entry of CODEX_DATA.entries) {
    if (discovered.has(entry.id)) continue;
    const cond = entry.unlockedBy;
    if (!cond) continue;
    let unlocked = false;

    switch (cond.type) {
      case 'level_reached':
        unlocked = level >= cond.value;
        break;
      case 'profession_skill': {
        const maxSkill = Math.max(0, ...Object.values(u.professions || {}).map(p => p.skill || 0));
        unlocked = maxSkill >= cond.value;
        break;
      }
      case 'bond_level':
        unlocked = (u.companion?.bondLevel || 0) >= cond.value;
        break;
      case 'mythic_cleared':
        unlocked = (u.highestMythicCleared || 0) >= cond.value;
        break;
      case 'quests_completed':
        unlocked = (u.questsCompleted || 0) >= cond.value;
        break;
      case 'streak':
        unlocked = (u.streakDays || 0) >= cond.value;
        break;
      case 'streak_days':
        unlocked = (u.streakDays || 0) >= cond.value;
        break;
      case 'world_boss_contributions':
        unlocked = (u._worldBossContributions || 0) >= cond.value;
        break;
      case 'dungeon_completed':
        unlocked = (u._dungeonCompletions || 0) >= cond.value;
        break;
      case 'rift_completions':
        unlocked = (u._riftCompletions || 0) >= cond.value;
        break;
      case 'unique_npcs_completed':
        unlocked = (u._npcsUnlocked || 0) >= cond.value;
        break;
      case 'crafts_completed':
        unlocked = (u._craftsCompleted || 0) >= cond.value;
        break;
      case 'trades_completed':
        unlocked = (u._tradesCompleted || 0) >= cond.value;
        break;
      case 'gem_tier': {
        const gems = u.gems || {};
        unlocked = Object.keys(gems).some(k => parseInt(k.split('_').pop() || '0', 10) >= cond.value);
        break;
      }
      case 'faction_rank': {
        const factions = u.factions || {};
        unlocked = Object.values(factions).some(f => (f && typeof f === 'object' ? f.rep || 0 : 0) >= (cond.value || 500));
        break;
      }
      case 'battlepass_level':
        unlocked = (u.battlePass?.level || 0) >= cond.value;
        break;
      // daily_missions_completed removed — no cumulative counter exists. Use level_reached instead.
      case 'quests_in_progress': {
        const inProgress = state.quests ? state.quests.filter(q => q.claimedBy?.toLowerCase() === userId && q.status === 'in_progress').length : 0;
        unlocked = inProgress >= cond.value;
        break;
      }
      case 'workshop_upgrade_purchased':
        unlocked = Object.keys(u.workshopUpgrades || {}).length >= cond.value;
        break;
      case 'friends_count': {
        const friendships = state.socialData?.friendships || [];
        const friendCount = friendships.filter(f => f.player1 === userId || f.player2 === userId).length;
        unlocked = friendCount >= cond.value;
        break;
      }
      case 'hidden':
        // Hidden entries — never auto-discovered
        unlocked = false;
        break;
      default:
        break;
    }

    if (unlocked && !discovered.has(entry.id)) {
      u.codexDiscovered.push(entry.id);
      discovered.add(entry.id); // Prevent duplicates within same call
      newEntries.push(entry.id);
    }
  }

  if (newEntries.length > 0) saveUsers();
  return newEntries;
}

// GET /api/codex — get all discovered codex entries
router.get('/api/codex', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  // Check for new discoveries
  checkCodexDiscovery(uid);

  const discovered = new Set(u.codexDiscovered || []);
  const entries = CODEX_DATA.entries.map(e => ({
    id: e.id,
    category: e.category,
    title: discovered.has(e.id) ? e.title : '???',
    text: discovered.has(e.id) ? e.text : null,
    discovered: discovered.has(e.id),
  }));

  res.json({
    categories: CODEX_DATA.categories,
    entries,
    discoveredCount: discovered.size,
    totalCount: CODEX_DATA.entries.length,
  });
});

module.exports = router;
module.exports.loadCodex = loadCodex;
module.exports.checkCodexDiscovery = checkCodexDiscovery;
