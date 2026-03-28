// ─── Quest API ──────────────────────────────────────────────────────────────────
const router = require('express').Router();
const { state, PLAYER_QUEST_TYPES, NPC_NAMES, XP_BY_PRIORITY, XP_BY_RARITY, saveQuests, saveData, savePlayerProgress, saveQuestCatalog, rebuildQuestsById, logActivity } = require('../lib/state');
const { now, getPlayerProgress, getLevelInfo, onQuestCompletedByUser, randGold, addLootToInventory } = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');
const { rebuildCatalogMeta } = require('../lib/quest-catalog');

// ─── Quest Pool (used by GET /api/quests and exported for config-admin) ──────
const POOL_TYPES = ['personal', 'learning', 'fitness', 'social', 'boss'];
const POOL_MIX = { personal: 3, learning: 3, fitness: 2, social: 2, boss: 1 };

function buildQuestPool(playerId, playerLevel) {
  const pp = getPlayerProgress(playerId);
  const completedIds = new Set(Object.keys(pp.completedQuests || {}));
  const claimedIds = new Set(pp.claimedQuests || []);
  const pool = [];
  for (const [type, count] of Object.entries(POOL_MIX)) {
    const candidates = state.quests.filter(q =>
      q.type === type && q.status === 'open' && !q.parentQuestId &&
      !completedIds.has(q.id) && !claimedIds.has(q.id) &&
      (!q.minLevel || q.minLevel <= playerLevel) &&
      !q.npcGiverId
    );
    // Fisher-Yates shuffle (uniform distribution)
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    pool.push(...candidates.slice(0, count).map(q => q.id));
  }
  return pool;
}

// ─── Helper: chain quest auto-unlock ─────────────────────────────────────────
function unlockNextChainQuest(completedQuest) {
  const chainId = completedQuest.chainId || completedQuest.chapter;
  const chainOrder = completedQuest.chainOrder;
  if (!chainId || typeof chainOrder !== 'number') return;
  const nextOrder = chainOrder + 1;
  const nextQuest = state.quests.find(q =>
    (q.chainId === chainId || q.chapter === chainId) &&
    q.chainOrder === nextOrder &&
    q.status === 'locked'
  );
  if (nextQuest) {
    nextQuest.status = 'open';
    saveQuests();
    console.log(`[Chain] Unlocked quest ${nextQuest.id} (${chainId} step ${nextOrder})`);
  }
}

// POST /api/quest — create a new quest
router.post('/api/quest', requireApiKey, (req, res) => {
  const { title, description, priority, category, categories, product, humanInputRequired, createdBy, type, parentQuestId, recurrence, proof, nextQuestTemplate, coopPartners, skills, lore, chapter, suggest, minLevel, classRequired, requiresRelationship, rarity } = req.body;
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required and must be a string' });
  if (title.length > 500) return res.status(400).json({ error: 'title too long (max 500 chars)' });
  if (description != null && typeof description !== 'string') return res.status(400).json({ error: 'description must be a string' });
  if (typeof description === 'string' && description.length > 5000) return res.status(400).json({ error: 'description too long (max 5000 chars)' });
  const validPriorities = ['low', 'medium', 'high'];
  const validCategories = ['Coding', 'Research', 'Content', 'Sales', 'Infrastructure', 'Bug Fix', 'Feature'];
  const validProducts = ['Dashboard', 'Companion App', 'Infrastructure', 'Other'];
  const validTypes = ['development', 'personal', 'learning', 'social', 'fitness', 'boss', 'relationship-coop', 'companion'];
  const validRecurrences = ['daily', 'weekly', 'monthly'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: `Invalid priority. Use: ${validPriorities.join(', ')}` });
  }
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Use: ${validTypes.join(', ')}` });
  }
  if (recurrence && !validRecurrences.includes(recurrence)) {
    return res.status(400).json({ error: `Invalid recurrence. Use: ${validRecurrences.join(', ')}` });
  }
  // Normalize: support both category (string, backward compat) and categories (array)
  let resolvedCategories = [];
  if (categories && Array.isArray(categories)) {
    const invalid = categories.find(c => !validCategories.includes(c));
    if (invalid) return res.status(400).json({ error: `Invalid category: ${invalid}. Use: ${validCategories.join(', ')}` });
    resolvedCategories = categories;
  } else if (category) {
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Use: ${validCategories.join(', ')}` });
    }
    resolvedCategories = [category];
  }
  if (product && !validProducts.includes(product)) {
    return res.status(400).json({ error: `Invalid product. Use: ${validProducts.join(', ')}` });
  }
  // Validate parentQuestId if provided
  if (parentQuestId) {
    const parent = state.questsById.get(parentQuestId);
    if (!parent) return res.status(400).json({ error: `Parent quest not found: ${parentQuestId}` });
  }
  const resolvedCreatedBy = typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'unknown';
  // Dobbie quest dedup: if same title was already created by dobbie today, return existing
  if (resolvedCreatedBy === 'dobbie') {
    const today = new Date().toISOString().slice(0, 10);
    const existing = state.quests.find(q => q.createdBy === 'dobbie' && q.title === title && (q.createdAt || '').slice(0, 10) === today);
    if (existing) {
      return res.json({ ok: true, quest: existing, duplicate: true });
    }
  }
  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'companion'];
  const resolvedRarity = resolvedCreatedBy === 'dobbie' ? 'companion' : (validRarities.includes(rarity) ? rarity : null);
  // Agent-created quests go to 'suggested' for human review; human-created stay 'open'
  // Player quest types (personal/learning/fitness/social) always bypass review → 'open'
  const HUMAN_CREATORS = ['leon', 'unknown', ...NPC_NAMES];
  const isAgentCreated = !HUMAN_CREATORS.includes(resolvedCreatedBy.toLowerCase());
  const resolvedType = type || 'development';
  const isPlayerQuestType = PLAYER_QUEST_TYPES.includes(resolvedType);
  const isAdminKey = !!(req.auth && req.auth.isAdmin);
  // If suggest=true or non-admin creates a development quest, set to suggested
  const forceSuggested = suggest === true;
  const questStatus = forceSuggested ? 'suggested' : ((isPlayerQuestType || !isAgentCreated) ? 'open' : 'suggested');
  // Validate nextQuestTemplate if provided
  let resolvedNextQuestTemplate = null;
  if (nextQuestTemplate && typeof nextQuestTemplate === 'object') {
    resolvedNextQuestTemplate = {
      title: String(nextQuestTemplate.title || '').trim() || null,
      description: String(nextQuestTemplate.description || '').trim() || null,
      type: validTypes.includes(nextQuestTemplate.type) ? nextQuestTemplate.type : resolvedType,
      priority: validPriorities.includes(nextQuestTemplate.priority) ? nextQuestTemplate.priority : (priority || 'medium'),
    };
    if (!resolvedNextQuestTemplate.title) resolvedNextQuestTemplate = null;
  }
  const quest = {
    id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description: description || '',
    priority: priority || 'medium',
    type: resolvedType,
    categories: resolvedCategories,
    product: product || null,
    humanInputRequired: humanInputRequired === true || humanInputRequired === 'true',
    createdBy: resolvedCreatedBy,
    status: questStatus,
    createdAt: now(),
    claimedBy: null,
    completedBy: null,
    completedAt: null,
    parentQuestId: parentQuestId || null,
    recurrence: validRecurrences.includes(recurrence) ? recurrence : null,
    streak: 0,
    lastCompletedAt: null,
    proof: proof || null,
    checklist: null,
    nextQuestTemplate: resolvedNextQuestTemplate,
    coopPartners: Array.isArray(coopPartners) && coopPartners.length > 0 ? coopPartners.slice(0, 2).map(p => String(p).toLowerCase()) : null,
    coopClaimed: [],
    coopCompletions: [],
    skills: Array.isArray(skills) ? skills.map(s => String(s).trim()).filter(Boolean).slice(0, 20) : [],
    lore: typeof lore === 'string' && lore.trim() ? lore.trim() : null,
    chapter: typeof chapter === 'string' && chapter.trim() ? chapter.trim() : null,
    minLevel: (typeof minLevel === 'number' && minLevel >= 1) ? Math.floor(minLevel) : 1,
    classRequired: classRequired || null,
    requiresRelationship: requiresRelationship === true || requiresRelationship === 'true',
    rewards: resolvedRarity ? { xp: XP_BY_RARITY[resolvedRarity] || 10, gold: randGold(resolvedRarity) } : { xp: 10, gold: randGold('common') },
    rarity: resolvedRarity || 'common',
  };
  state.quests.push(quest);
  state.questsById.set(quest.id, quest);
  saveQuests();
  // Auto-add template entry to catalog
  try {
    const tpl = {
      id: `tpl-${quest.id}`,
      title: quest.title,
      description: quest.description || '',
      type: quest.type,
      category: quest.parentQuestId ? 'chainQuest' : (quest.skills && quest.skills.length > 0 ? 'classQuest' : 'generic'),
      classId: quest.skills && quest.skills.length > 0 ? quest.skills[0] : null,
      minLevel: quest.minLevel || 1,
      chainId: quest.parentQuestId || null,
      chainOrder: null,
      difficulty: quest.difficulty || (quest.priority === 'high' ? 'advanced' : quest.priority === 'medium' ? 'intermediate' : 'starter'),
      estimatedTime: null,
      rewards: { xp: XP_BY_RARITY[quest.rarity] || XP_BY_PRIORITY[quest.priority] || 10, gold: 0 },
      tags: quest.skills || [],
      createdBy: quest.createdBy,
      createdAt: quest.createdAt,
    };
    state.questCatalog.templates.push(tpl);
    if (tpl.id) state.questCatalogById.set(tpl.id, tpl);
    rebuildCatalogMeta();
    saveQuestCatalog();
  } catch (e) { console.warn('[quest] Failed to seed catalog template:', e.message); }
  console.log(`[quest] created: ${quest.id} — "${title}"`);
  res.json({ ok: true, quest });
});

// PATCH /api/quest/:id/checklist — update checklist items on a quest
// Body: { items: [{ text: string, done: boolean }] }
router.patch('/api/quest/:id/checklist', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  quest.checklist = items.map(i => ({ text: String(i.text || ''), done: !!i.done }));
  saveQuests();
  res.json({ ok: true, checklist: quest.checklist });
});

// POST /api/quests/household-rotate — rotate auto_assign for recurring household quests
// Cycles through the provided assignees list and assigns the next person
router.post('/api/quests/household-rotate', requireApiKey, (req, res) => {
  const { assignees } = req.body; // e.g. ["leon", "user2"]
  if (!Array.isArray(assignees) || assignees.length === 0) {
    return res.status(400).json({ error: 'assignees must be a non-empty array' });
  }
  const household = state.quests.filter(q => q.recurrence && q.status === 'open' && !q.claimedBy);
  let rotated = 0;
  household.forEach((q, i) => {
    q.claimedBy = assignees[i % assignees.length];
    q.status = 'in_progress';
    rotated++;
  });
  if (rotated > 0) saveQuests();
  res.json({ ok: true, rotated });
});

// POST /api/quest/:id/claim — agent/player claims a quest
router.post('/api/quest/:id/claim', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const agentKey = agentId.toLowerCase();

  // NPC quests: per-player tracking (quest stays globally open for others)
  if (quest.npcGiverId && state.users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (!pp.npcQuests) pp.npcQuests = {};
    const npcStatus = pp.npcQuests[quest.id];
    if (npcStatus && npcStatus.status === 'completed') {
      return res.status(409).json({ error: 'Quest already completed by this player' });
    }
    if (npcStatus && npcStatus.status === 'in_progress') {
      return res.status(409).json({ error: 'Quest already claimed by this player' });
    }
    // Check chain order: previous quest in chain must be completed by this player
    const npcQuestIds = state.npcState.npcQuestIds[quest.npcGiverId] || [];
    const chainIdx = npcQuestIds.indexOf(quest.id);
    if (chainIdx > 0) {
      const prevQuestId = npcQuestIds[chainIdx - 1];
      const prevStatus = pp.npcQuests[prevQuestId];
      if (!prevStatus || prevStatus.status !== 'completed') {
        return res.status(409).json({ error: 'Previous quest in chain not completed' });
      }
    }
    pp.npcQuests[quest.id] = { status: 'in_progress', claimedAt: now() };
    savePlayerProgress();
    console.log(`[quest] ${quest.id} claimed (npc per-player) by ${agentKey}`);
    return res.json({ ok: true, quest: { ...quest, status: 'in_progress', claimedBy: agentKey } });
  }

  // Player quest types use per-player tracking
  if (PLAYER_QUEST_TYPES.includes(quest.type) && state.users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (pp.completedQuests && pp.completedQuests[quest.id]) {
      return res.status(409).json({ error: 'Quest already completed by this player' });
    }
    if (pp.claimedQuests.includes(quest.id)) {
      return res.status(409).json({ error: 'Quest already claimed by this player' });
    }
    pp.claimedQuests.push(quest.id);
    savePlayerProgress();
    quest.status = 'in_progress';
    quest.claimedBy = agentKey;
    saveQuests();
    console.log(`[quest] ${quest.id} claimed (per-player) by ${agentKey}`);
    return res.json({ ok: true, quest: { ...quest, status: 'in_progress', claimedBy: agentKey } });
  }

  // Dev quests / non-player users: global shared state
  if (quest.status !== 'open') return res.status(409).json({ error: `Quest is already ${quest.status}` });
  quest.status = 'in_progress';
  quest.claimedBy = agentId;
  saveQuests();
  console.log(`[quest] ${quest.id} claimed by ${agentId}`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/complete — mark quest as done
router.post('/api/quest/:id/complete', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const agentKey = agentId.toLowerCase();

  // NPC quests: per-player completion (quest stays globally available for others)
  if (quest.npcGiverId && state.users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (!pp.npcQuests) pp.npcQuests = {};
    const npcStatus = pp.npcQuests[quest.id];
    if (npcStatus && npcStatus.status === 'completed') {
      return res.status(409).json({ error: 'Quest already completed by this player' });
    }
    pp.npcQuests[quest.id] = { status: 'completed', completedAt: now(), completedBy: agentKey };
    savePlayerProgress();
    // Award XP/achievements to the player
    const prevLevel = getLevelInfo(state.users[agentKey]?.xp ?? 0).level;
    const newAchievements = onQuestCompletedByUser(agentKey, quest);
    const u = state.users[agentKey];
    const newLevelInfo = getLevelInfo(u?.xp ?? 0);
    const lootDrop = u?._lastLoot || null;
    const companionReward = u?._lastCompanionReward || null;
    const xpEarned = u?._lastXpEarned || 0;
    const goldEarned = u?._lastGoldEarned || 0;
    if (u) { delete u._lastLoot; delete u._lastCompanionReward; delete u._lastXpEarned; delete u._lastGoldEarned; }
    // Grant NPC's final reward item when the last quest in the chain is completed
    let npcFinalReward = null;
    if (quest.chainIndex != null && quest.chainTotal && quest.chainIndex === quest.chainTotal - 1) {
      const giver = state.npcGivers.givers.find(g => g.id === quest.npcGiverId);
      if (u) {
        u._npcsUnlocked = (u._npcsUnlocked || 0) + 1;
      }
      if (giver?.finalReward?.item && u) {
        const item = giver.finalReward.item;
        addLootToInventory(agentKey, item);
        npcFinalReward = item;
        saveUsers();
        console.log(`[npc] Final reward '${item.id}' granted to ${agentKey} for completing ${giver.name}'s chain`);
      }
    }
    // Activity feed
    logActivity(agentKey, 'quest_complete', { quest: quest.title || quest.id, rarity: quest.rarity || 'common', xp: xpEarned, gold: goldEarned });
    if (u && newLevelInfo.level > prevLevel) logActivity(agentKey, 'level_up', { level: newLevelInfo.level, title: newLevelInfo.title });
    if (newAchievements.length > 0) for (const ach of newAchievements) logActivity(agentKey, 'achievement', { achievementId: ach.id, name: ach.name || ach.id, rarity: ach.rarity, points: ach.points || 0 });
    console.log(`[quest] ${quest.id} completed (npc per-player) by ${agentKey}`);
    return res.json({
      ok: true,
      quest: { ...quest, status: 'completed', completedBy: agentKey, completedAt: now() },
      newAchievements,
      lootDrop,
      npcFinalReward,
      companionReward,
      xpEarned,
      goldEarned,
      chainQuestTemplate: quest.nextQuestTemplate || null,
      levelUp: newLevelInfo.level > prevLevel ? { level: newLevelInfo.level, title: newLevelInfo.title } : null,
    });
  }

  // Player quest types: per-player completion (quest stays globally open for others)
  if (PLAYER_QUEST_TYPES.includes(quest.type) && state.users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (pp.completedQuests && pp.completedQuests[quest.id]) {
      return res.status(409).json({ error: 'Quest already completed by this player' });
    }
    const completedAt = now();
    pp.completedQuests[quest.id] = { at: completedAt, proof: quest.proof || null };
    pp.claimedQuests = (pp.claimedQuests || []).filter(id => id !== quest.id);
    // Track recurrence streak per player (in playerProgress)
    if (quest.recurrence) {
      pp.recurringStreak = pp.recurringStreak || {};
      pp.recurringStreak[quest.id] = (pp.recurringStreak[quest.id] || 0) + 1;
    }
    savePlayerProgress();
    unlockNextChainQuest(quest);
    const prevLevel2 = getLevelInfo(state.users[agentKey]?.xp ?? 0).level;
    const newAchievements = onQuestCompletedByUser(agentKey, quest);
    const u2 = state.users[agentKey];
    const newLevelInfo2 = getLevelInfo(u2?.xp ?? 0);
    const lootDrop = u2?._lastLoot || null;
    const companionReward = u2?._lastCompanionReward || null;
    const xpEarned = u2?._lastXpEarned || 0;
    const goldEarned = u2?._lastGoldEarned || 0;
    if (u2) { delete u2._lastLoot; delete u2._lastCompanionReward; delete u2._lastXpEarned; delete u2._lastGoldEarned; }
    // Activity feed
    logActivity(agentKey, 'quest_complete', { quest: quest.title || quest.id, rarity: quest.rarity || 'common', xp: xpEarned, gold: goldEarned });
    if (u2 && newLevelInfo2.level > prevLevel2) logActivity(agentKey, 'level_up', { level: newLevelInfo2.level, title: newLevelInfo2.title });
    if (newAchievements.length > 0) for (const ach of newAchievements) logActivity(agentKey, 'achievement', { achievementId: ach.id, name: ach.name || ach.id, rarity: ach.rarity, points: ach.points || 0 });
    console.log(`[quest] ${quest.id} completed (per-player) by ${agentKey}`);
    return res.json({
      ok: true,
      quest: { ...quest, status: 'completed', completedBy: agentKey, completedAt },
      newAchievements,
      lootDrop,
      companionReward,
      xpEarned,
      goldEarned,
      chainQuestTemplate: quest.nextQuestTemplate || null,
      levelUp: newLevelInfo2.level > prevLevel2 ? { level: newLevelInfo2.level, title: newLevelInfo2.title } : null,
    });
  }

  // Dev quests / non-player users: global shared state
  if (quest.status === 'completed') return res.status(409).json({ error: 'Quest already completed' });
  quest.status = 'completed';
  quest.completedBy = agentId;
  quest.completedAt = now();
  if (quest.recurrence) {
    quest.streak = (quest.streak || 0) + 1;
    quest.lastCompletedAt = now();
  }
  saveQuests();
  unlockNextChainQuest(quest);
  let newAchievements = [];
  const prevLevel3 = getLevelInfo(state.users[agentKey]?.xp ?? 0).level;
  if (state.users[agentKey]) {
    newAchievements = onQuestCompletedByUser(agentKey, quest);
  }
  const u3 = state.users[agentKey];
  const newLevelInfo3 = getLevelInfo(u3?.xp ?? 0);
  const lootDrop = u3?._lastLoot || null;
  const companionReward = u3?._lastCompanionReward || null;
  const xpEarned = u3?._lastXpEarned || 0;
  const goldEarned = u3?._lastGoldEarned || 0;
  const runensplitterEarned = u3?._lastRunensplitterEarned || 0;
  const gildentalerEarned = u3?._lastGildentalerEarned || 0;
  if (u3) { delete u3._lastLoot; delete u3._lastCompanionReward; delete u3._lastXpEarned; delete u3._lastGoldEarned; delete u3._lastRunensplitterEarned; delete u3._lastGildentalerEarned; }
  // Activity feed: quest completion + optional level-up
  if (state.users[agentKey]) {
    logActivity(agentKey, 'quest_complete', { quest: quest.title || quest.id, rarity: quest.rarity || 'common', xp: xpEarned, gold: goldEarned });
    if (u3 && newLevelInfo3.level > prevLevel3) {
      logActivity(agentKey, 'level_up', { level: newLevelInfo3.level, title: newLevelInfo3.title });
    }
    if (newAchievements.length > 0) {
      for (const ach of newAchievements) {
        logActivity(agentKey, 'achievement', { name: ach.name || ach.id, rarity: ach.rarity || 'common', points: ach.points || 0 });
      }
    }
    if (lootDrop && (lootDrop.rarity === 'epic' || lootDrop.rarity === 'legendary')) {
      logActivity(agentKey, 'rare_drop', { item: lootDrop.name || lootDrop.id, rarity: lootDrop.rarity });
    }
  }
  console.log(`[quest] ${quest.id} completed by ${agentId}`);
  res.json({ ok: true, quest, newAchievements, lootDrop, companionReward, xpEarned, goldEarned, runensplitterEarned, gildentalerEarned, chainQuestTemplate: quest.nextQuestTemplate || null, levelUp: u3 && newLevelInfo3.level > prevLevel3 ? { level: newLevelInfo3.level, title: newLevelInfo3.title } : null });
});

// POST /api/quest/:id/unclaim — agent/player unclaims a quest
router.post('/api/quest/:id/unclaim', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const agentKey = agentId.toLowerCase();

  // NPC quests: per-player tracking via playerProgress.npcQuests
  if (quest.npcGiverId && state.users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    const npcStatus = (pp.npcQuests || {})[quest.id];
    if (!npcStatus || npcStatus.status !== 'in_progress') {
      return res.status(409).json({ error: 'NPC quest not claimed by this player' });
    }
    delete pp.npcQuests[quest.id];
    savePlayerProgress();
    console.log(`[quest] ${quest.id} unclaimed (npc per-player) by ${agentKey}`);
    return res.json({ ok: true, quest: { ...quest, status: 'open', claimedBy: null } });
  }

  // Player quest types use per-player tracking
  if (PLAYER_QUEST_TYPES.includes(quest.type) && state.users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (!pp.claimedQuests.includes(quest.id)) {
      return res.status(409).json({ error: 'Quest not claimed by this player' });
    }
    pp.claimedQuests = pp.claimedQuests.filter(id => id !== quest.id);
    savePlayerProgress();
    quest.status = 'open';
    quest.claimedBy = null;
    saveQuests();
    console.log(`[quest] ${quest.id} unclaimed (per-player) by ${agentKey}`);
    return res.json({ ok: true, quest: { ...quest, status: 'open', claimedBy: null } });
  }

  // Dev quests / non-player users: global shared state
  if ((quest.claimedBy || '').toLowerCase() !== agentKey) {
    return res.status(409).json({ error: `Quest not claimed by this agent` });
  }
  quest.status = 'open';
  quest.claimedBy = null;
  saveQuests();
  console.log(`[quest] ${quest.id} unclaimed by ${agentId}`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/coop-claim — player claims their part of a co-op quest
router.post('/api/quest/:id/coop-claim', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.type !== 'relationship-coop') return res.status(400).json({ error: 'Not a co-op quest' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const uid = userId.toLowerCase();
  if (quest.coopPartners && !quest.coopPartners.includes(uid)) {
    return res.status(403).json({ error: 'User is not a co-op partner for this quest' });
  }
  quest.coopClaimed = quest.coopClaimed || [];
  if (quest.coopClaimed.includes(uid)) {
    return res.status(409).json({ error: 'Already claimed by this user' });
  }
  quest.coopClaimed.push(uid);
  if (quest.status === 'open') {
    quest.status = 'in_progress';
    quest.claimedBy = uid;
  }
  saveQuests();
  console.log(`[coop] ${quest.id} co-claimed by ${uid}`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/coop-complete — player marks their part as done
router.post('/api/quest/:id/coop-complete', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.type !== 'relationship-coop') return res.status(400).json({ error: 'Not a co-op quest' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const uid = userId.toLowerCase();
  quest.coopCompletions = quest.coopCompletions || [];
  if (quest.coopCompletions.includes(uid)) {
    return res.status(409).json({ error: 'Already marked complete by this user' });
  }
  quest.coopCompletions.push(uid);
  // Check if all partners have completed
  const partners = quest.coopPartners || quest.coopClaimed || [];
  const allDone = partners.length > 0 && partners.every(p => quest.coopCompletions.includes(p));
  let newAchievements = [];
  if (allDone) {
    quest.status = 'completed';
    quest.completedAt = now();
    quest.completedBy = quest.coopCompletions.join('+');
    for (const partnerId of partners) {
      if (state.users[partnerId]) {
        const achs = onQuestCompletedByUser(partnerId, quest);
        newAchievements = [...newAchievements, ...achs];
      }
    }
  }
  saveQuests();
  console.log(`[coop] ${quest.id} part completed by ${uid} — allDone: ${allDone}`);
  res.json({ ok: true, quest, allDone, newAchievements });
});

// GET /api/quests — list all quests grouped by status
// ?player=X  → overlays per-player state for player quest types + applies minLevel filtering
// ─── Shared quest data builder (used by GET /api/quests and /api/dashboard) ──
const RARITY_REWARDS = {
  common:    { xp: 10, gold: 8  },
  uncommon:  { xp: 18, gold: 14 },
  rare:      { xp: 30, gold: 24 },
  epic:      { xp: 50, gold: 40 },
  legendary: { xp: 80, gold: 65 },
};
function ensureRewards(q) {
  if (q.rewards && q.rewards.xp > 0) return q;
  const fallback = RARITY_REWARDS[q.rarity] || RARITY_REWARDS.common;
  return { ...q, rewards: fallback };
}

function getQuestsData(playerParam, typeFilter) {
  const allCampaignQuestIds = new Set(state.campaigns.flatMap(c => c.questIds));

  // Pre-build parent->children index once per request (O(n) instead of O(n^2))
  const _childrenByParent = new Map();
  for (const q of state.quests) {
    if (q.parentQuestId) {
      let arr = _childrenByParent.get(q.parentQuestId);
      if (!arr) { arr = []; _childrenByParent.set(q.parentQuestId, arr); }
      arr.push(q);
    }
  }
  function enrichEpics(list) {
    return list.map(q => {
      const children = _childrenByParent.get(q.id);
      if (!children || children.length === 0) return q;
      const completedCount = children.filter(c => c.status === 'completed').length;
      return { ...q, children, progress: { completed: completedCount, total: children.length } };
    });
  }

  function filterAndEnrich(statusFilter, sourceList) {
    const src = sourceList || state.quests;
    let list = src.filter(q => q.status === statusFilter && !q.parentQuestId && !allCampaignQuestIds.has(q.id));
    if (typeFilter) list = list.filter(q => q.type === typeFilter);
    return enrichEpics(list);
  }

  if (playerParam) {
    const userRecord = state.users[playerParam];
    const playerXp   = userRecord ? (userRecord.xp || 0) : 0;
    const playerLevel = getLevelInfo(playerXp).level;
    const pp = getPlayerProgress(playerParam);
    const completedIds = new Set(Object.keys(pp.completedQuests || {}));
    const claimedIds   = new Set(pp.claimedQuests || []);

    // Partition quests into player-type vs dev-type
    const allTopLevel = state.quests.filter(q => !q.parentQuestId && !allCampaignQuestIds.has(q.id));
    const playerTypeQuests = allTopLevel.filter(q => PLAYER_QUEST_TYPES.includes(q.type || 'development'));
    const devTypeQuests    = allTopLevel.filter(q => !PLAYER_QUEST_TYPES.includes(q.type || 'development'));

    // Apply per-player status overlay to player quest types
    const openPlayer       = [];
    const inProgressPlayer = [];
    const completedPlayer  = [];
    const lockedPlayer     = [];

    const playerClassId = userRecord ? (userRecord.classId || null) : null;
    for (const q of playerTypeQuests) {
      if (typeFilter && q.type !== typeFilter) continue;
      // Skip suggested/rejected (not visible to players)
      if (q.status === 'suggested' || q.status === 'rejected') continue;
      // Skip class-gated quests that don't match this player's class (completely invisible)
      if (q.classRequired && q.classRequired !== playerClassId) continue;

      // NPC quests: use per-player tracking from playerProgress.npcQuests
      if (q.npcGiverId) {
        const playerNpcQuests = pp.npcQuests || {};
        const npcStatus = playerNpcQuests[q.id];
        if (npcStatus && npcStatus.status === 'in_progress') {
          inProgressPlayer.push({ ...q, status: 'in_progress', claimedBy: playerParam });
        } else if (npcStatus && npcStatus.status === 'completed') {
          completedPlayer.push({ ...q, status: 'completed', completedBy: playerParam, completedAt: npcStatus.completedAt });
        }
        // open/locked NPC quests are shown via the NPC board, not the player Quest Board
        continue;
      }

      const minLvl = q.minLevel || 1;
      if (playerLevel < minLvl) {
        lockedPlayer.push({ ...q, playerStatus: 'locked' });
        continue;
      }
      if (completedIds.has(q.id)) {
        const record = pp.completedQuests[q.id] || {};
        completedPlayer.push({ ...q, status: 'completed', completedBy: playerParam, completedAt: record.at || null, claimedBy: playerParam });
      } else if (claimedIds.has(q.id)) {
        inProgressPlayer.push({ ...q, status: 'in_progress', claimedBy: playerParam });
      } else {
        openPlayer.push({ ...q, status: 'open', claimedBy: null, completedBy: null });
      }
    }

    // Per-player pool: only show quests from this player's generated pool
    // activeQuestPool = visible subset (~11), generatedQuests = full 18
    // Prefer activeQuestPool if populated, else fall back to generatedQuests
    const poolIds = pp.activeQuestPool && pp.activeQuestPool.length > 0
      ? pp.activeQuestPool
      : (pp.generatedQuests || []).slice(0, 11);
    const visibleIds = new Set(poolIds);
    const poolFilteredOpen = visibleIds.size > 0
      ? openPlayer.filter(q => visibleIds.has(q.id))
      : openPlayer;

    // Dev quest types use global status as-is
    return {
      open:       [...enrichEpics(poolFilteredOpen),  ...filterAndEnrich('open',        devTypeQuests)].map(ensureRewards),
      inProgress: [...enrichEpics(inProgressPlayer), ...filterAndEnrich('in_progress', devTypeQuests)].map(ensureRewards),
      completed:  [...enrichEpics(completedPlayer),  ...filterAndEnrich('completed',   devTypeQuests)].map(ensureRewards),
      suggested:  filterAndEnrich('suggested', devTypeQuests).map(ensureRewards),
      rejected:   filterAndEnrich('rejected',  devTypeQuests).map(ensureRewards),
      // Show up to 3 locked quests as teaser, sorted by minLevel ascending
      locked: lockedPlayer.sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1)).slice(0, 3).map(ensureRewards),
    };
  }

  return {
    open:       filterAndEnrich('open').map(ensureRewards),
    inProgress: filterAndEnrich('in_progress').map(ensureRewards),
    completed:  filterAndEnrich('completed').map(ensureRewards),
    suggested:  filterAndEnrich('suggested').map(ensureRewards),
    rejected:   filterAndEnrich('rejected').map(ensureRewards),
  };
}

router.get('/api/quests', (req, res) => {
  const typeFilter  = req.query.type;
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  res.json(getQuestsData(playerParam, typeFilter));
});

// POST /api/quest/:id/approve — approve a suggested quest → open (admin only)
router.post('/api/quest/:id/approve', requireApiKey, (req, res) => {
  if (!req.auth?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status !== 'suggested') return res.status(409).json({ error: `Quest is not in suggested state (current: ${quest.status})` });
  quest.status = 'open';
  if (req.body && req.body.comment) quest.comment = req.body.comment;
  saveQuests();
  console.log(`[quest] ${quest.id} approved → open`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/reject — reject any non-completed quest → rejected (admin only)
router.post('/api/quest/:id/reject', requireApiKey, (req, res) => {
  if (!req.auth?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status === 'completed') return res.status(409).json({ error: 'Cannot reject a completed quest' });
  quest.status = 'rejected';
  if (req.body && req.body.comment) quest.comment = req.body.comment;
  saveQuests();
  console.log(`[quest] ${quest.id} rejected`);
  res.json({ ok: true, quest });
});

// PATCH /api/quest/:id — update quest fields (priority, proof, title, description, claimedBy, etc.)
router.patch('/api/quest/:id', requireApiKey, (req, res) => {
  const quest = state.questsById.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { priority, proof, title, description, status, claimedBy } = req.body;
  if (priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
    quest.priority = priority;
  }
  if (proof !== undefined) quest.proof = proof;
  if (title !== undefined) quest.title = title;
  if (description !== undefined) quest.description = description;
  if (req.body.flavorText !== undefined) quest.flavorText = req.body.flavorText;
  if (req.body.lore !== undefined) quest.lore = req.body.lore;
  if (claimedBy !== undefined) {
    quest.claimedBy = claimedBy;
    if (claimedBy && quest.status === 'open') quest.status = 'in_progress';
    if (!claimedBy && quest.status === 'in_progress') quest.status = 'open';
  }
  if (status !== undefined) {
    const validStatuses = ['open', 'in_progress', 'completed', 'suggested', 'rejected'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const wasCompleted = quest.status === 'completed';
    quest.status = status;
    if (status === 'completed' && !wasCompleted) {
      quest.completedAt = quest.completedAt || now();
      unlockNextChainQuest(quest);
      const completerId = (quest.claimedBy || '').toLowerCase();
      if (completerId && state.users[completerId]) {
        onQuestCompletedByUser(completerId, quest);
      }
    }
  }
  saveQuests();
  res.json({ ok: true, quest });
});

// PATCH /api/quests/:id/complete — mark a quest as completed
router.patch('/api/quests/:id/complete', requireApiKey, (req, res) => {
  const { id } = req.params;
  const { completedBy } = req.body;

  const quest = state.questsById.get(id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status === 'completed') return res.status(409).json({ error: 'Quest already completed' });

  quest.status = 'completed';
  quest.completedBy = completedBy || 'unknown';
  quest.completedAt = now();
  saveQuests();
  unlockNextChainQuest(quest);
  const agentKey2 = (completedBy || '').toLowerCase();
  let newAchievements = [];
  if (state.users[agentKey2]) {
    newAchievements = onQuestCompletedByUser(agentKey2, quest);
  }
  res.json({ success: true, message: 'Quest completed', quest, newAchievements });
});

// POST /api/quests/bulk-update — update status of multiple quests at once
router.post('/api/quests/bulk-update', requireApiKey, (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array' });
  const validStatuses = ['open', 'in_progress', 'completed', 'suggested', 'rejected'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });

  const updated = [];
  const notFound = [];
  // Build index for O(1) lookups instead of O(n) per id
  const questMap = new Map(state.quests.map(q => [q.id, q]));
  for (const id of ids) {
    const quest = questMap.get(id);
    if (!quest) { notFound.push(id); continue; }
    const wasNotCompleted = quest.status !== 'completed';
    quest.status = status;
    if (status === 'completed' && !quest.completedAt) {
      quest.completedAt = now();
      if (wasNotCompleted && quest.claimedBy) {
        const completerId = quest.claimedBy.toLowerCase();
        if (state.users[completerId]) {
          onQuestCompletedByUser(completerId, quest);
        }
      }
    }
    updated.push(id);
  }
  if (updated.length > 0) { saveQuests(); }
  console.log(`[bulk-update] status=${status} updated=${updated.length} notFound=${notFound.length}`);
  res.json({ ok: true, updated, notFound });
});

// POST /api/quests/import — bulk create quests from a JSON array (Batch API pipeline)
// Body: { quests: [ { title, description, priority, type, ... }, ... ] }
// Returns: { created: [...ids], skipped: number, errors: [...] }
router.post('/api/quests/import', requireApiKey, (req, res) => {
  const incoming = req.body.quests;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'Body must contain a non-empty "quests" array' });
  }
  const VALID_TYPES     = ['development', 'personal', 'learning', 'fitness', 'social', 'boss', 'companion', 'relationship-coop'];
  const VALID_PRIORITIES = ['low', 'medium', 'high'];
  const created = [];
  const errors  = [];
  let skipped   = 0;

  for (const [i, q] of incoming.entries()) {
    if (!q.title || typeof q.title !== 'string') {
      errors.push({ index: i, reason: 'Missing or invalid title' });
      continue;
    }
    const type     = VALID_TYPES.includes(q.type)       ? q.type     : 'development';
    const priority = VALID_PRIORITIES.includes(q.priority) ? q.priority : 'medium';
    // Dedup guard: skip if a quest with identical title + type already exists and is open/in_progress
    const isDuplicate = state.quests.some(
      ex => ex.title === q.title.trim() && ex.type === type && ['open','in_progress'].includes(ex.status)
    );
    if (isDuplicate) { skipped++; continue; }

    const id = `quest-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const importedQuest = {
      id,
      title:              q.title.trim(),
      description:        q.description || '',
      priority,
      type,
      categories:         Array.isArray(q.categories) ? q.categories : [],
      product:            q.product    || null,
      humanInputRequired: q.humanInputRequired ?? false,
      createdBy:          q.createdBy  || 'import',
      status:             'open',
      createdAt:          now(),
      claimedBy:          q.claimedBy  || null,
      completedBy:        null,
      completedAt:        null,
      parentQuestId:      q.parentQuestId || null,
      recurrence:         q.recurrence   || null,
      streak:             0,
      lore:               q.lore         || null,
      flavor:             q.flavor       || null,
      rewards:            q.rewards      || null,
      chapter:            q.chapter      || null,
      nextQuestTemplate:  q.nextQuestTemplate || null,
      coopPartners:       q.coopPartners || null,
      skills:             q.skills       || null,
      minLevel:           q.minLevel     || null,
      classRequired:      q.classRequired || null,
      proof:              null,
      checklist:          Array.isArray(q.checklist) ? q.checklist : null,
      rarity:             q.rarity || 'common',
    };
    state.quests.push(importedQuest);
    state.questsById.set(importedQuest.id, importedQuest);
    created.push(id);
  }

  if (created.length > 0) saveQuests();
  console.log(`[import] created=${created.length} skipped=${skipped} errors=${errors.length}`);
  res.json({ ok: true, created, skipped, errors });
});

module.exports = router;
module.exports.POOL_TYPES = POOL_TYPES;
module.exports.POOL_MIX = POOL_MIX;
module.exports.buildQuestPool = buildQuestPool;
module.exports.getQuestsData = getQuestsData;
