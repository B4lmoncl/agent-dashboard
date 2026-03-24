/**
 * Dungeon / Instance System — "The Undercroft"
 * Async cooperative group dungeons (2-4 players).
 * 8-hour idle timer, outcome based on combined Gear Score + companion bond.
 * 7-day cooldown per dungeon. 3 tiers: Normal (Lv10+), Hard (Lv20+), Legendary (Lv35+).
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, saveUsers, saveSocial, ensureUserCurrencies, RUNTIME_DIR, logActivity } = require('../lib/state');
const { now, getLevelInfo, awardCurrency, getGearScore, getBondLevel, rollLoot, addLootToInventory, createUniqueInstance, trackUniqueInCollection, getLegendaryModifiers } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

// ─── Dungeon Templates ──────────────────────────────────────────────────────

let dungeonTemplates = [];

function loadDungeonTemplates() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'dungeons.json'), 'utf8');
    const data = JSON.parse(raw);
    dungeonTemplates = data.dungeons || [];
    console.log(`[dungeons] Loaded ${dungeonTemplates.length} dungeon templates`);
  } catch (e) {
    console.error('[dungeons] Failed to load dungeon templates:', e.message);
    dungeonTemplates = [];
  }
}

function getDungeon(id) {
  return dungeonTemplates.find(d => d.id === id) || null;
}

// ─── Dungeon Run State ──────────────────────────────────────────────────────

const DUNGEON_STATE_FILE = path.join(RUNTIME_DIR, 'dungeonState.json');

let dungeonState = {
  activeRuns: {},
  cooldowns: {},
  history: [],
};

function loadDungeonState() {
  try {
    if (fs.existsSync(DUNGEON_STATE_FILE)) {
      dungeonState = JSON.parse(fs.readFileSync(DUNGEON_STATE_FILE, 'utf8'));
      if (!dungeonState.activeRuns) dungeonState.activeRuns = {};
      if (!dungeonState.cooldowns) dungeonState.cooldowns = {};
      if (!dungeonState.history) dungeonState.history = [];
      console.log(`[dungeons] Loaded dungeon state: ${Object.keys(dungeonState.activeRuns).length} active runs`);
    }
  } catch (e) {
    console.error('[dungeons] Failed to load dungeon state:', e.message);
  }
}

function saveDungeonState() {
  try {
    fs.writeFileSync(DUNGEON_STATE_FILE, JSON.stringify(dungeonState, null, 2));
  } catch (e) {
    console.error('[dungeons] Failed to save dungeon state:', e.message);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId() {
  return `dng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPlayerGearScore(userId) {
  const { gearScore } = getGearScore(userId);
  return gearScore || 0;
}

function getPlayerBondLevel(userId) {
  const u = state.users[userId];
  if (!u || !u.companion) return 0;
  return u.companion.bondLevel || 0;
}

function isOnCooldown(userId, dungeonId) {
  const cd = (dungeonState.cooldowns[userId] || {})[dungeonId];
  if (!cd) return { onCooldown: false };
  const endsAt = new Date(cd).getTime() + 7 * 24 * 3600000;
  if (Date.now() >= endsAt) {
    // Cooldown expired, clean up
    delete dungeonState.cooldowns[userId][dungeonId];
    return { onCooldown: false };
  }
  return { onCooldown: true, endsAt: new Date(endsAt).toISOString(), remainingMs: endsAt - Date.now() };
}

function getActiveRunForPlayer(userId) {
  for (const [runId, run] of Object.entries(dungeonState.activeRuns)) {
    if (run.participants.includes(userId) || run.invitedPlayers.includes(userId)) {
      return { runId, run };
    }
  }
  return null;
}

function areFriends(a, b) {
  return (state.socialData?.friendships || []).some(
    f => (f.player1 === a && f.player2 === b) || (f.player1 === b && f.player2 === a)
  );
}

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateSuccessChance(effectivePower, threshold, participantCount) {
  const scaledThreshold = threshold * participantCount;
  if (effectivePower >= scaledThreshold) return 1.0;
  if (effectivePower >= scaledThreshold * 0.7) return 0.7;
  if (effectivePower >= scaledThreshold * 0.5) return 0.4;
  return 0.15;
}

function rollDungeonRewards(dungeon, isSuccess) {
  const rewards = dungeon.rewards;
  const multiplier = isSuccess ? 1 : 0.25;

  const result = {
    gold: Math.round(randRange(rewards.gold[0], rewards.gold[1]) * multiplier),
    essenz: Math.round(randRange(rewards.essenz[0], rewards.essenz[1]) * multiplier),
    runensplitter: Math.round(randRange(rewards.runensplitter[0], rewards.runensplitter[1]) * multiplier),
  };

  if (rewards.sternentaler) {
    result.sternentaler = Math.round(randRange(rewards.sternentaler[0], rewards.sternentaler[1]) * multiplier);
  }

  if (rewards.materials) {
    result.materialCount = Math.round(randRange(rewards.materials.count[0], rewards.materials.count[1]) * multiplier);
  }

  // Gem drop — only on success
  if (isSuccess && rewards.gems && Math.random() < rewards.gems.chance) {
    result.gemTier = Math.min(rewards.gems.maxTier, Math.floor(Math.random() * rewards.gems.maxTier) + 1);
  }

  // Gear drop — only on success
  if (isSuccess && rewards.gearDrop && Math.random() < rewards.gearDrop.chance) {
    result.gearDrop = true;
    result.gearMinRarity = rewards.gearDrop.minRarity;
  }

  return result;
}

function applyDungeonRewards(userId, rewards) {
  const u = state.users[userId];
  if (!u) return;
  ensureUserCurrencies(u);

  if (rewards.gold) awardCurrency(userId, 'gold', rewards.gold);
  if (rewards.essenz) awardCurrency(userId, 'essenz', rewards.essenz);
  if (rewards.runensplitter) awardCurrency(userId, 'runensplitter', rewards.runensplitter);
  if (rewards.sternentaler) awardCurrency(userId, 'sternentaler', rewards.sternentaler);

  // Materials — award random crafting materials (use actual profession materials)
  if (rewards.materialCount && rewards.materialCount > 0) {
    const allMaterials = state.professionsData?.materials || [];
    if (allMaterials.length > 0) {
      if (!u.craftingMaterials) u.craftingMaterials = {};
      for (let i = 0; i < rewards.materialCount; i++) {
        const mat = allMaterials[Math.floor(Math.random() * allMaterials.length)];
        u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + 1;
      }
    }
  }
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

// ─── Stale Run Cleanup ───────────────────────────────────────────────────────
// Called lazily on GET — prunes forming runs older than 24h
function pruneStaleRuns() {
  const MAX_FORMING_AGE_MS = 24 * 3600000; // 24 hours
  let pruned = 0;
  for (const [runId, run] of Object.entries(dungeonState.activeRuns)) {
    if (run.status === 'forming' && run.createdAt) {
      const age = Date.now() - new Date(run.createdAt).getTime();
      if (age > MAX_FORMING_AGE_MS) {
        delete dungeonState.activeRuns[runId];
        pruned++;
      }
    }
  }
  if (pruned > 0) {
    saveDungeonState();
    console.log(`[dungeons] Pruned ${pruned} stale forming runs`);
  }
}

// GET /api/dungeons — list dungeons with player status
router.get('/api/dungeons', (req, res) => {
  pruneStaleRuns();
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  const uid = u ? (u.id || playerName) : null;
  const lvl = u ? getLevelInfo(u.xp || 0).level : 0;

  const dungeons = dungeonTemplates.map(d => {
    const cooldown = uid ? isOnCooldown(uid, d.id) : { onCooldown: false };
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      accent: d.accent,
      tier: d.tier,
      minLevel: d.minLevel,
      minPlayers: d.minPlayers,
      maxPlayers: d.maxPlayers,
      durationHours: d.durationHours,
      cooldownDays: d.cooldownDays,
      gearScoreThreshold: d.gearScoreThreshold,
      rewards: d.rewards,
      bonusRewards: d.bonusRewards,
      unlocked: lvl >= d.minLevel,
      cooldown,
      // Unique item drop previews
      uniqueItemDetails: (state.uniqueItems || [])
        .filter(u => u.source === `dungeon:${d.id}`)
        .map(u => ({ id: u.id, name: u.name, slot: u.slot, desc: u.desc, flavorText: u.flavorText, legendaryEffect: u.legendaryEffect, icon: u.icon })),
    };
  });

  // Find active run for this player
  let activeRun = null;
  if (uid) {
    const found = getActiveRunForPlayer(uid);
    if (found) {
      const { runId, run } = found;
      const dungeon = getDungeon(run.dungeonId);
      activeRun = {
        runId,
        dungeonId: run.dungeonId,
        dungeonName: dungeon?.name || run.dungeonId,
        dungeonIcon: dungeon?.icon || '',
        dungeonAccent: dungeon?.accent || '#888',
        tier: dungeon?.tier || 'normal',
        createdBy: run.createdBy,
        createdAt: run.createdAt,
        status: run.status,
        participants: run.participants.map(pid => {
          const pu = state.usersByName.get(pid) || state.users[pid];
          return {
            name: pid,
            avatar: pu?.avatar || '',
            color: pu?.color || '#888',
            gearScore: run.participantGearScores[pid] || 0,
            bondLevel: run.participantBondLevels[pid] || 0,
          };
        }),
        invitedPlayers: run.invitedPlayers.filter(p => !run.participants.includes(p)).map(pid => {
          const pu = state.usersByName.get(pid) || state.users[pid];
          return { name: pid, avatar: pu?.avatar || '', color: pu?.color || '#888' };
        }),
        startedAt: run.startedAt,
        completesAt: run.completesAt,
        collected: run.collected || [],
        minPlayers: dungeon?.minPlayers || 2,
        maxPlayers: dungeon?.maxPlayers || 4,
        gearScoreThreshold: dungeon?.gearScoreThreshold || 100,
      };
    }
  }

  // Player's recent dungeon history (last 5)
  const history = uid
    ? (dungeonState.history || [])
        .filter(h => h.participants.includes(uid))
        .slice(-5)
        .reverse()
    : [];

  res.json({ dungeons, activeRun, history });
});

// POST /api/dungeons/cancel — cancel a forming run (creator only)
router.post('/api/dungeons/cancel', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId required' });
  const run = dungeonState.activeRuns[runId];
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.createdBy !== uid) return res.status(403).json({ error: 'Only the creator can cancel' });
  if (run.status !== 'forming') return res.status(400).json({ error: 'Can only cancel forming runs' });
  delete dungeonState.activeRuns[runId];
  saveDungeonState();
  console.log(`[dungeons] ${uid} cancelled forming run ${runId}`);
  res.json({ ok: true, message: 'Dungeon run cancelled.' });
});

// POST /api/dungeons/create — create a dungeon run and invite friends
router.post('/api/dungeons/create', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { dungeonId, invitePlayers } = req.body;
  if (!dungeonId || typeof dungeonId !== 'string') return res.status(400).json({ error: 'dungeonId required' });

  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return res.status(400).json({ error: 'Unknown dungeon' });

  // Level check
  const lvl = getLevelInfo(u.xp || 0).level;
  if (lvl < dungeon.minLevel) {
    return res.status(400).json({ error: `Requires level ${dungeon.minLevel} (you are ${lvl})` });
  }

  // Cooldown check
  const cd = isOnCooldown(uid, dungeonId);
  if (cd.onCooldown) {
    return res.status(400).json({ error: `On cooldown until ${cd.endsAt}`, cooldown: cd });
  }

  // Active run check
  const existing = getActiveRunForPlayer(uid);
  if (existing) {
    return res.status(400).json({ error: 'You already have an active dungeon run', runId: existing.runId });
  }

  // Validate invites: deduplicate, prevent self-invite
  const invited = [...new Set(
    Array.isArray(invitePlayers) ? invitePlayers.map(p => String(p).toLowerCase()).filter(Boolean) : []
  )].filter(n => n !== uid);
  if (invited.length === 0) {
    return res.status(400).json({ error: 'Must invite at least 1 friend' });
  }
  if (invited.length > dungeon.maxPlayers - 1) {
    return res.status(400).json({ error: `Max ${dungeon.maxPlayers} players total (you + ${dungeon.maxPlayers - 1} friends)` });
  }

  // Validate each invited player exists and is a friend
  for (const invName of invited) {
    const invUser = state.usersByName.get(invName);
    if (!invUser) {
      return res.status(400).json({ error: `Player "${invName}" not found` });
    }
    if (!areFriends(uid, invUser.id || invName)) {
      return res.status(400).json({ error: `"${invName}" is not on your friends list` });
    }
  }

  // Create run
  const runId = genId();
  const gearScore = getPlayerGearScore(uid);
  const bondLevel = getPlayerBondLevel(uid);

  dungeonState.activeRuns[runId] = {
    dungeonId,
    createdBy: uid,
    createdAt: now(),
    startedAt: null,
    completesAt: null,
    status: 'forming',
    participants: [uid],
    invitedPlayers: invited,
    participantGearScores: { [uid]: gearScore },
    participantBondLevels: { [uid]: bondLevel },
    collected: [],
  };

  saveDungeonState();
  console.log(`[dungeons] ${uid} created run ${runId} for ${dungeon.name}, invited: ${invited.join(', ')}`);

  res.json({
    ok: true,
    runId,
    message: `Dungeon run created! Waiting for ${invited.join(', ')} to join.`,
    run: dungeonState.activeRuns[runId],
  });
});

// POST /api/dungeons/:runId/join — accept dungeon invite
router.post('/api/dungeons/:runId/join', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { runId } = req.params;
  const run = dungeonState.activeRuns[runId];
  if (!run) return res.status(404).json({ error: 'Dungeon run not found' });

  if (run.status !== 'forming') {
    return res.status(400).json({ error: 'Dungeon has already started' });
  }

  // Check invite
  if (!run.invitedPlayers.includes(uid)) {
    return res.status(403).json({ error: 'You were not invited to this dungeon' });
  }

  if (run.participants.includes(uid)) {
    return res.status(400).json({ error: 'You already joined this run' });
  }

  // Level check
  const dungeon = getDungeon(run.dungeonId);
  if (!dungeon) return res.status(500).json({ error: 'Dungeon template not found' });

  const lvl = getLevelInfo(u.xp || 0).level;
  if (lvl < dungeon.minLevel) {
    return res.status(400).json({ error: `Requires level ${dungeon.minLevel} (you are ${lvl})` });
  }

  // Cooldown check
  const cd = isOnCooldown(uid, run.dungeonId);
  if (cd.onCooldown) {
    return res.status(400).json({ error: `On cooldown until ${cd.endsAt}` });
  }

  // Active run check (if player is already in another run)
  const otherRun = getActiveRunForPlayer(uid);
  if (otherRun && otherRun.runId !== runId) {
    return res.status(400).json({ error: 'You already have an active dungeon run' });
  }

  // Add participant
  run.participants.push(uid);
  run.participantGearScores[uid] = getPlayerGearScore(uid);
  run.participantBondLevels[uid] = getPlayerBondLevel(uid);

  // Auto-start when minPlayers reached
  if (run.participants.length >= dungeon.minPlayers) {
    run.status = 'active';
    run.startedAt = now();
    run.completesAt = new Date(Date.now() + dungeon.durationHours * 3600000).toISOString();
    console.log(`[dungeons] Run ${runId} auto-started with ${run.participants.length} players (min: ${dungeon.minPlayers})`);
  }

  saveDungeonState();
  console.log(`[dungeons] ${uid} joined run ${runId} (${run.participants.length} participants)`);

  res.json({
    ok: true,
    message: run.status === 'active'
      ? `Joined! Dungeon started — completes in ${dungeon.durationHours} hours.`
      : `Joined! Waiting for more players (${run.participants.length}/${dungeon.minPlayers} minimum).`,
    run,
  });
});

// POST /api/dungeons/:runId/collect — collect rewards after dungeon completes
router.post('/api/dungeons/:runId/collect', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { runId } = req.params;
  const run = dungeonState.activeRuns[runId];
  if (!run) return res.status(404).json({ error: 'Dungeon run not found' });

  if (run.status !== 'active') {
    return res.status(400).json({ error: 'Dungeon is not active' });
  }

  if (!run.participants.includes(uid)) {
    return res.status(403).json({ error: 'You are not a participant in this run' });
  }

  if (run.collected.includes(uid)) {
    return res.status(400).json({ error: 'You already collected rewards for this run' });
  }

  // Check if dungeon has completed (8h elapsed)
  if (!run.completesAt || Date.now() < new Date(run.completesAt).getTime()) {
    const remaining = run.completesAt ? new Date(run.completesAt).getTime() - Date.now() : 0;
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    return res.status(400).json({ error: `Dungeon still in progress. ${h}h ${m}m remaining.` });
  }

  const dungeon = getDungeon(run.dungeonId);
  if (!dungeon) return res.status(500).json({ error: 'Dungeon template not found' });

  // Mark collected BEFORE success determination to prevent duplicate collection
  run.collected.push(uid);

  // ── Determine run success ONCE (first collector calculates, subsequent reuse) ──
  const participantCount = run.participants.length;
  if (run.success === undefined) {
    // First collector determines outcome for the entire group
    let totalGearScore = 0;
    let totalBond = 0;
    for (const pid of run.participants) {
      totalGearScore += (run.participantGearScores[pid] || 0);
      totalBond += (run.participantBondLevels[pid] || 0);
    }
    const bondBonus = totalBond * 5;
    run.effectivePower = totalGearScore + bondBonus;
    run.threshold = dungeon.gearScoreThreshold * participantCount;
    run.successChance = calculateSuccessChance(run.effectivePower, dungeon.gearScoreThreshold, participantCount);
    run.success = Math.random() < run.successChance;
  }

  const isSuccess = run.success;
  const effectivePower = run.effectivePower;

  // Roll individual rewards (each player gets own rolls)
  const rewards = rollDungeonRewards(dungeon, isSuccess);

  // Apply legendary dungeon loot bonus to gold/essenz
  const dungeonMods = getLegendaryModifiers(uid);
  const lootMulti = 1 + (dungeonMods.dungeonLootBonus || 0);
  if (lootMulti !== 1) {
    rewards.gold = Math.round((rewards.gold || 0) * lootMulti);
    rewards.essenz = Math.round((rewards.essenz || 0) * lootMulti);
  }

  // ── Actual gear drop: roll a real item via rollLoot ──
  if (isSuccess && rewards.gearDrop) {
    const playerLevel = getLevelInfo(u.xp || 0).level;
    // Enforce minimum rarity: re-roll up to 5 times if below dungeon minimum
    const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const minIdx = RARITY_ORDER.indexOf(rewards.gearMinRarity || 'rare');
    let gearItem = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      gearItem = rollLoot(1.0, playerLevel);
      if (!gearItem) break;
      if (RARITY_ORDER.indexOf(gearItem.rarity || 'common') >= minIdx) break;
    }
    // Final fallback: force rarity if still too low (keeps stats from last roll)
    if (gearItem && RARITY_ORDER.indexOf(gearItem.rarity || 'common') < minIdx) {
      gearItem.rarity = rewards.gearMinRarity || 'rare';
    }
    if (gearItem) {
      addLootToInventory(uid, gearItem);
      rewards.gearDropItem = { name: gearItem.name, rarity: gearItem.rarity, slot: gearItem.slot };
    }
    delete rewards.gearDrop;
    delete rewards.gearMinRarity;
  }

  // ── Unique item drop from dungeon source ──
  let uniqueDrop = null;
  if (isSuccess) {
    const dungeonUniques = (state.uniqueItems || []).filter(
      ui => ui.source === `dungeon:${dungeon.id}`
    );
    for (const uniqueTemplate of dungeonUniques) {
      if (Math.random() < (uniqueTemplate.dropChance || 0.05)) {
        // Check if player already owns this unique
        const alreadyOwns = (u.equipment && Object.values(u.equipment).some(e => e && e.templateId === uniqueTemplate.id && e.isUnique))
          || (u.inventory || []).some(i => i.templateId === uniqueTemplate.id && i.isUnique);
        if (!alreadyOwns) {
          const gearInstance = createUniqueInstance(uniqueTemplate);
          if (!u.inventory) u.inventory = [];
          u.inventory.push(gearInstance);
          trackUniqueInCollection(uid, uniqueTemplate.id);
          if (!u.collectionLogDates) u.collectionLogDates = {};
          u.collectionLogDates[uniqueTemplate.id] = now();
          uniqueDrop = { name: uniqueTemplate.name, slot: uniqueTemplate.slot, id: uniqueTemplate.id };
          break; // Max 1 unique per run
        }
      }
    }
  }

  // Apply currency/material rewards
  applyDungeonRewards(uid, rewards);

  // Set cooldown
  if (!dungeonState.cooldowns[uid]) dungeonState.cooldowns[uid] = {};
  dungeonState.cooldowns[uid][run.dungeonId] = now();

  // Award bonus rewards on first success — title + frame
  let bonusAwarded = null;
  if (isSuccess && dungeon.bonusRewards) {
    const titles = u.earnedTitles || [];
    if (dungeon.bonusRewards.title && !titles.some(t => t.name === dungeon.bonusRewards.title)) {
      if (!u.earnedTitles) u.earnedTitles = [];
      u.earnedTitles.push({
        id: `dungeon-title-${dungeon.id}`,
        name: dungeon.bonusRewards.title,
        rarity: dungeon.tier === 'legendary' ? 'legendary' : dungeon.tier === 'hard' ? 'epic' : 'rare',
        earnedAt: now(),
      });
      bonusAwarded = { title: dungeon.bonusRewards.title };
    }
    if (dungeon.bonusRewards.frame) {
      if (!u.unlockedFrames) u.unlockedFrames = [];
      if (!u.unlockedFrames.some(f => f.id === dungeon.bonusRewards.frame.id)) {
        u.unlockedFrames.push({
          ...dungeon.bonusRewards.frame,
          unlockedAt: now(),
        });
        if (!bonusAwarded) bonusAwarded = {};
        bonusAwarded.frame = dungeon.bonusRewards.frame.name;
      }
    }
  }

  // Log activity for social feed
  logActivity(uid, 'quest_complete', {
    questTitle: `${dungeon.name} (Dungeon)`,
    rarity: dungeon.tier === 'legendary' ? 'legendary' : dungeon.tier === 'hard' ? 'epic' : 'rare',
  });

  // If all participants collected, finalize run → move to history
  if (run.collected.length >= run.participants.length) {
    dungeonState.history.push({
      runId,
      dungeonId: run.dungeonId,
      dungeonName: dungeon.name,
      tier: dungeon.tier,
      createdBy: run.createdBy,
      participants: [...run.participants],
      startedAt: run.startedAt,
      completedAt: now(),
      success: isSuccess,
      effectivePower,
      threshold: dungeon.gearScoreThreshold * participantCount,
      successChance: run.successChance,
    });
    if (dungeonState.history.length > 100) {
      dungeonState.history = dungeonState.history.slice(-100);
    }
    delete dungeonState.activeRuns[runId];
  }

  saveUsers();
  saveDungeonState();

  console.log(`[dungeons] ${uid} collected from run ${runId}: success=${isSuccess}, rewards=${JSON.stringify(rewards)}`);

  res.json({
    ok: true,
    success: isSuccess,
    successChance: Math.round(run.successChance * 100),
    effectivePower,
    threshold: dungeon.gearScoreThreshold * participantCount,
    rewards,
    bonusAwarded,
    uniqueDrop,
    message: isSuccess
      ? `Dungeon cleared! You conquered ${dungeon.name}!`
      : `The group barely escaped ${dungeon.name}. Consolation rewards received.`,
  });
});

// GET /api/dungeons/:runId — run details
router.get('/api/dungeons/:runId', (req, res) => {
  const { runId } = req.params;
  const run = dungeonState.activeRuns[runId];
  if (!run) {
    // Check history
    const hist = dungeonState.history.find(h => h.runId === runId);
    if (hist) return res.json({ run: null, history: hist });
    return res.status(404).json({ error: 'Run not found' });
  }

  const dungeon = getDungeon(run.dungeonId);

  res.json({
    run: {
      ...run,
      dungeonName: dungeon?.name || run.dungeonId,
      dungeonIcon: dungeon?.icon || '',
      dungeonAccent: dungeon?.accent || '#888',
      tier: dungeon?.tier || 'normal',
      minPlayers: dungeon?.minPlayers || 2,
      maxPlayers: dungeon?.maxPlayers || 4,
      gearScoreThreshold: dungeon?.gearScoreThreshold || 100,
      participants: run.participants.map(pid => {
        const pu = state.usersByName.get(pid) || state.users[pid];
        return {
          name: pid,
          avatar: pu?.avatar || '',
          color: pu?.color || '#888',
          level: getLevelInfo(pu?.xp || 0).level,
          gearScore: run.participantGearScores[pid] || 0,
          bondLevel: run.participantBondLevels[pid] || 0,
        };
      }),
    },
  });
});

function isDungeonActiveForPlayer(playerId) {
  if (!playerId) return false;
  return Object.values(dungeonState.activeRuns || {}).some(
    r => r && r.participants?.includes(playerId) && r.status !== 'completed'
  );
}

module.exports = router;
module.exports.loadDungeonTemplates = loadDungeonTemplates;
module.exports.loadDungeonState = loadDungeonState;
module.exports.isDungeonActiveForPlayer = isDungeonActiveForPlayer;
