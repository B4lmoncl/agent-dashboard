/**
 * NPC Engine — NPC spawn, departure, rotation logic.
 */
const {
  state, NPC_MAX_ACTIVE, NPC_PERMANENT_IDS, NPC_DEFAULT_WEIGHTS, TIMEZONE,
  saveQuests, saveNpcState, savePlayerProgress, rebuildQuestsById,
} = require('./state');
const { getTodayBerlin } = require('./helpers');
const { resolveQuest } = require('./quest-templates');

function weightedRandomNpc(candidates) {
  if (!candidates.length) return null;
  const totalWeight = candidates.reduce((sum, c) => sum + (c.spawnWeight || NPC_DEFAULT_WEIGHTS[c.rarity] || 10), 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= (c.spawnWeight || NPC_DEFAULT_WEIGHTS[c.rarity] || 10);
    if (roll <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

function processNpcDepartures(now) {
  const stillActive = [];
  let questsChanged = false;
  let playerProgressChanged = false;

  if (!Array.isArray(state.npcState.activeNpcs)) state.npcState.activeNpcs = [];
  for (const active of state.npcState.activeNpcs) {
    const departureTime = active.departureTime || active.expiresAt;
    if (Date.now() > new Date(departureTime).getTime()) {
      const questIds = state.npcState.npcQuestIds[active.giverId] || [];
      const giver = state.npcGivers.givers.find(g => g.id === active.giverId);

      for (let i = state.quests.length - 1; i >= 0; i--) {
        const q = state.quests[i];
        if (!questIds.includes(q.id)) continue;
        if (q.status === 'completed') continue;

        if (q.status === 'in_progress' || q.status === 'claimed') {
          q.status = 'failed';
          q.failReason = 'npc_departed';
          q.failedAt = now.toISOString();
          questsChanged = true;
        } else {
          state.quests.splice(i, 1);
          questsChanged = true;
        }
      }

      const cooldownMs = ((giver && giver.cooldownHours) || 48) * 3600000;
      state.npcState.cooldowns[active.giverId] = new Date(Date.now() + cooldownMs).toISOString();
      delete state.npcState.npcQuestIds[active.giverId];

      // CLEANUP: Fail all in-progress NPC chains for this NPC in playerProgress
      Object.values(state.playerProgress).forEach(pp => {
        if (!pp.npcQuests) return;
        Object.entries(pp.npcQuests).forEach(([firstQuestId, nq]) => {
          if (questIds.includes(firstQuestId) && nq.status === 'in_progress') {
            nq.status = 'failed';
            nq.failReason = 'npc_departed';
            nq.failedAt = now.toISOString();
            playerProgressChanged = true;
          }
        });
      });

      if (!state.npcState.departureNotifications) state.npcState.departureNotifications = [];
      state.npcState.departureNotifications.push({
        npcId: active.giverId,
        npcName: (giver && giver.name) || active.giverId,
        departedAt: now.toISOString(),
      });

      console.log(`[npc] ${(giver && giver.name) || active.giverId} has departed`);
    } else {
      stillActive.push(active);
    }
  }

  state.npcState.activeNpcs = stillActive;
  if (questsChanged) {
    rebuildQuestsById(); // splice() removed quests from array — Map must match
    saveQuests();
  }
  if (playerProgressChanged) savePlayerProgress();
  if (questsChanged || playerProgressChanged) saveNpcState();
}

function getSpawnMultiplier(activeCount) {
  if (activeCount <= 3) return 1.0;
  if (activeCount === 4) return 0.7;
  if (activeCount === 5) return 0.4;
  if (activeCount === 6) return 0.2;
  return 0;
}

// ─── Shared NPC spawn helper ─────────────────────────────────────────────────
// Spawns a single NPC: creates quests, registers in npcState, returns true if spawned.
function spawnNpc(giver, now) {
  const baseDepartureMs = (giver.departureDurationHours || (giver.stayDays || 3) * 24) * 3600000;
  const jitteredMs = baseDepartureMs * (0.8 + Math.random() * 0.4);
  const arrivedAt = now.toISOString();
  const departureTime = new Date(Date.now() + jitteredMs).toISOString();

  const chains = giver.questChains || (giver.questChain ? [giver.questChain] : [[]]);
  const chain = chains[Math.floor(Math.random() * chains.length)];

  const questIds = [];
  const npcContext = { npcName: giver.name, npcRarity: giver.rarity };
  for (const qt of chain) {
    const resolved = resolveQuest(qt, npcContext);
    const quest = {
      id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: resolved.title,
      description: resolved.description || '',
      priority: resolved.priority || 'medium',
      type: resolved.type || 'personal',
      categories: [],
      product: null,
      humanInputRequired: false,
      createdBy: giver.id,
      status: questIds.length === 0 ? 'open' : 'locked',
      createdAt: arrivedAt,
      claimedBy: null,
      completedBy: null,
      completedAt: null,
      parentQuestId: null,
      recurrence: null,
      streak: 0,
      lastCompletedAt: null,
      proof: null,
      checklist: null,
      nextQuestTemplate: null,
      coopPartners: null,
      coopClaimed: [],
      coopCompletions: [],
      skills: [],
      lore: resolved.lore || null,
      chapter: null,
      minLevel: 1,
      npcGiverId: giver.id,
      npcName: giver.name,
      npcRarity: giver.rarity,
      flavorText: resolved.flavorText || null,
      chainIndex: chain.indexOf(qt),
      chainTotal: chain.length,
      rarity: giver.rarity,
      rewards: resolved.rewards,
      npcRewards: resolved.rewards,
    };
    state.quests.push(quest);
    state.questsById.set(quest.id, quest);
    questIds.push(quest.id);
  }
  state.npcState.npcQuestIds[giver.id] = questIds;
  saveQuests();

  state.npcState.activeNpcs.push({
    giverId: giver.id,
    arrivedAt,
    departureTime,
    expiresAt: departureTime,
    questChainIndex: chains.indexOf(chain),
  });

  return { jitteredMs, chain, chains };
}

function trySpawnNpcs(now) {
  const currentActive = state.npcState.activeNpcs.length;
  if (currentActive >= NPC_MAX_ACTIVE) return;

  const maxSpawnThisCycle = 2;
  let spawned = 0;

  const activeIds = new Set(state.npcState.activeNpcs.map(a => a.giverId));

  for (let slot = 0; slot < maxSpawnThisCycle; slot++) {
    if (state.npcState.activeNpcs.length + spawned >= NPC_MAX_ACTIVE) break;
    const baseChance = slot === 0 ? 0.80 : 0.30;
    const multiplier = getSpawnMultiplier(currentActive + spawned);
    if (Math.random() > baseChance * multiplier) continue;

    const candidates = state.npcGivers.givers.filter(g => {
      if (NPC_PERMANENT_IDS.has(g.id)) return false;
      if (activeIds.has(g.id)) return false;
      const cooldownUntil = state.npcState.cooldowns[g.id];
      if (cooldownUntil && Date.now() < new Date(cooldownUntil).getTime()) return false;
      return true;
    });

    const giver = weightedRandomNpc(candidates);
    if (!giver) break;

    const { jitteredMs, chain, chains } = spawnNpc(giver, now);
    activeIds.add(giver.id);
    spawned++;

    console.log(`[npc] ${giver.name} has arrived (departs ~${Math.round(jitteredMs / 3600000)}h, ${chain.length} quests, chain ${chains.indexOf(chain) + 1}/${chains.length})`);
  }
}

function forceSpawnMinimumNpc(now) {
  if (state.npcState.activeNpcs.length > 0) return;
  const activeIds = new Set(state.npcState.activeNpcs.map(a => a.giverId));
  const candidates = state.npcGivers.givers.filter(g => {
    if (NPC_PERMANENT_IDS.has(g.id)) return false;
    if (activeIds.has(g.id)) return false;
    if (g.rarity !== 'common' && g.rarity !== 'uncommon') return false;
    const cooldownUntil = state.npcState.cooldowns[g.id];
    if (cooldownUntil && Date.now() < new Date(cooldownUntil).getTime()) return false;
    return true;
  });
  if (!candidates.length) {
    const fallback = state.npcGivers.givers.filter(g => !NPC_PERMANENT_IDS.has(g.id) && !activeIds.has(g.id));
    if (fallback.length) candidates.push(...fallback);
  }
  const giver = weightedRandomNpc(candidates);
  if (!giver) return;

  spawnNpc(giver, now);
  console.log(`[npc] Force-spawned ${giver.name} (tavern was empty)`);
}

function checkCompanionQuestTimeLimits() {
  const nowMs = Date.now();
  let changed = false;
  for (const q of state.quests) {
    if (q.rarity !== 'companion') continue;
    if (q.status !== 'open' && q.status !== 'in_progress') continue;
    if (!q.timeLimit) continue;
    const [hours, minutes] = q.timeLimit.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) continue;
    const questDate = q.createdAt ? q.createdAt.slice(0, 10) : getTodayBerlin();
    const utcGuess = new Date(`${questDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
    const refDate = new Date(questDate + 'T12:00:00Z');
    const berlinParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(refDate);
    const bH = parseInt(berlinParts.find(p => p.type === 'hour').value);
    const offsetHours = bH - 12;
    const timeLimitMs = utcGuess.getTime() - offsetHours * 3600000;
    if (nowMs > timeLimitMs) {
      q.status = 'failed';
      q.failReason = 'time_expired';
      q.failedAt = new Date().toISOString();
      changed = true;
      console.log(`[Companion] Quest "${q.title}" (${q.id}) failed — timeLimit ${q.timeLimit} expired`);
    }
  }
  if (changed) saveQuests();
}

function checkPeriodicTasks() {
  const now = new Date();
  checkCompanionQuestTimeLimits();
  state.npcState.lastRotationCheck = now.toISOString();
  saveNpcState();
}

function midnightNpcSpawn() {
  // Called ONLY at midnight Berlin time (from dailyQuestRotation)
  // This is the ONLY time NPCs arrive or depart
  const now = new Date();
  console.log(`[npc] Midnight rotation at ${now.toISOString()} — ${state.npcState.activeNpcs.length} active`);
  processNpcDepartures(now);
  trySpawnNpcs(now);
  forceSpawnMinimumNpc(now);
  state.npcState.lastRotation = now.toISOString();
  state.npcState.lastRotationCheck = now.toISOString();
  saveNpcState();
}

function startupNpcCheck() {
  const now = new Date();
  console.log(`[npc] Startup check — ${state.npcState.activeNpcs.length} active`);
  // On startup: only process departures, do NOT spawn new NPCs
  // New NPCs arrive only at midnight via midnightNpcSpawn()
  // Exception: if tavern is completely empty, force-spawn 1 so it's not dead
  processNpcDepartures(now);
  if (state.npcState.activeNpcs.length === 0) {
    forceSpawnMinimumNpc(now);
  }
  state.npcState.lastRotationCheck = now.toISOString();
  saveNpcState();
}

function rotateNpcs() { midnightNpcSpawn(); }

module.exports = {
  weightedRandomNpc,
  processNpcDepartures,
  getSpawnMultiplier,
  trySpawnNpcs,
  forceSpawnMinimumNpc,
  checkCompanionQuestTimeLimits,
  checkPeriodicTasks,
  midnightNpcSpawn,
  startupNpcCheck,
  rotateNpcs,
};
