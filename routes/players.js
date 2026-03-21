// ─── Player API ────────────────────────────────────────────────────────────────
const router = require('express').Router();
const { state, NPC_META, saveUsers, savePlayerProgress } = require('../lib/state');
const { now, todayStr, getLevelInfo, getPlayerProgress, calcDynamicForgeTemp, getBondLevel, onQuestCompletedByUser } = require('../lib/helpers');
const { requireAuth, requireSelf } = require('../lib/middleware');

// PATCH /api/player/:name/profile — update profile settings [auth + self]
router.patch('/api/player/:name/profile', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const { relationshipStatus, partnerName, classId } = req.body;
  const validStatuses = ['single', 'relationship', 'married', 'complicated', 'other'];
  if (relationshipStatus !== undefined) {
    if (!validStatuses.includes(relationshipStatus)) return res.status(400).json({ error: 'Invalid status' });
    u.relationshipStatus = relationshipStatus;
  }
  if (partnerName !== undefined) u.partnerName = partnerName || null;
  // Allow setting/changing class
  if (classId !== undefined) {
    if (classId === null || classId === '') {
      u.classId = null;
      u.classPending = false;
    } else {
      const cls = state.classesData.classes.find(c => c.id === classId);
      if (cls) {
        // Decrement old class playerCount
        if (u.classId && u.classId !== classId) {
          const oldCls = state.classesData.classes.find(c => c.id === u.classId);
          if (oldCls) oldCls.playerCount = Math.max(0, (oldCls.playerCount || 1) - 1);
        }
        // Only increment if actually changing to new class
        if (u.classId !== classId) cls.playerCount = (cls.playerCount || 0) + 1;
        u.classId = cls.id;
        u.classPending = cls.status === 'pending';
        u.classPendingNotified = false;
        const { saveClasses } = require('../lib/state');
        saveClasses();
      } else {
        return res.status(400).json({ error: 'Class not found' });
      }
    }
  }
  saveUsers();
  res.json({ ok: true, relationshipStatus: u.relationshipStatus || 'single', partnerName: u.partnerName || null, classId: u.classId || null });
});

// GET /api/player/:name — get player progress (level, xp, gold, quest counts, claimed)
router.get('/api/player/:name', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const userRecord = state.users[uid];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(uid);
  const levelInfo = getLevelInfo(userRecord.xp || 0);
  // Dynamic forgeTemp: stored value with 2%/hr time decay
  const dynamicForgeTemp = calcDynamicForgeTemp(uid);
  // Calculate modifier breakdown
  const { getXpMultiplier, getGoldMultiplier, getForgeXpBase, getForgeGoldBase, getKraftBonus, getWeisheitBonus, getUserGear, getQuestHoardingMalus, getLegendaryModifiers } = require('../lib/helpers');
  const forgeXpPure = getForgeXpBase(uid);
  const kraftBonus = getKraftBonus(uid);
  const forgeXp = getXpMultiplier(uid);
  const forgeGoldPure = getForgeGoldBase(uid);
  const weisheitBonus = getWeisheitBonus(uid);
  const forgeGold = getGoldMultiplier(uid);
  const gear = getUserGear(uid);
  const gearBonus = 1 + (gear.xpBonus || 0) / 100;
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const earnedIds = new Set((userRecord.earnedAchievements || []).map(a => a.id));
  const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
  const bondLevel = userRecord.companion?.bondLevel ?? 1;
  const bondBonus = 1 + 0.01 * Math.max(0, bondLevel - 1);
  const streakDays = userRecord.streakDays || 0;
  const streakGold = Math.min(1 + streakDays * 0.015, 1.45);
  const hoarding = getQuestHoardingMalus(uid);
  const hoardingMultiplier = hoarding.multiplier;
  const legendaryMods = getLegendaryModifiers(uid);
  const totalXp = +(forgeXp * gearBonus * companionBonus * bondBonus * hoardingMultiplier * legendaryMods.xpBonus).toFixed(2);
  const totalGold = +(forgeGold * streakGold * legendaryMods.goldBonus).toFixed(2);

  res.json({
    id: uid,
    name: userRecord.name,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    xp: userRecord.xp || 0,
    nextXp: levelInfo.nextXp,
    levelProgress: levelInfo.progress,
    gold: userRecord.gold || 0,
    completedQuestsCount: Object.keys(pp.completedQuests || {}).length,
    claimedQuests: pp.claimedQuests || [],
    streakDays,
    forgeTemp: dynamicForgeTemp,
    modifiers: {
      xp: { forge: forgeXpPure, kraft: kraftBonus, gear: gearBonus, companions: companionBonus, bond: bondBonus, hoarding: hoardingMultiplier, hoardingCount: hoarding.count, hoardingPct: hoarding.malusPct, legendary: legendaryMods.xpBonus, total: totalXp },
      gold: { forge: forgeGoldPure, weisheit: weisheitBonus, streak: streakGold, legendary: legendaryMods.goldBonus, total: totalGold },
    },
  });
});

// GET /api/player/:name/notifications — check for pending class-activation notifications
router.get('/api/player/:name/notifications', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const userRecord = state.users[uid];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });

  const notifications = [];

  // Check if player had a pending class that is now active
  if (userRecord.classId && userRecord.classPending && !userRecord.classPendingNotified) {
    const cls = state.classesData.classes.find(c => c.id === userRecord.classId);
    if (cls && cls.status === 'active') {
      notifications.push({
        type: 'class_activated',
        classId: cls.id,
        className: cls.fantasy,
        classIcon: cls.icon,
        classDescription: cls.description,
        skillTree: cls.skillTree || [],
      });
      // Mark as notified
      userRecord.classPending = false;
      userRecord.classPendingNotified = true;
      saveUsers();
    }
  }

  res.json({ notifications });
});

// GET /api/users/:id/achievements — get earned achievements for a user
router.get('/api/users/:id/achievements', (req, res) => {
  const u = state.users[req.params.id.toLowerCase()];
  if (!u) return res.status(404).json({ error: 'User not found' });
  // Enrich with catalogue data (icon/desc may be missing on old entries)
  const enriched = (u.earnedAchievements || []).map(a => {
    const tpl = state.achievementCatalogueById?.get(a.id);
    if (!tpl) return a;
    return { ...a, icon: a.icon || tpl.icon, desc: a.desc || tpl.desc, rarity: a.rarity || tpl.rarity };
  });
  res.json(enriched);
});

// GET /api/player/:name/companion — get companion details + quests
router.get('/api/player/:name/companion', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.json({ companion: null, quests: [] });
  const bondInfo = getBondLevel(u.companion.bondXp || 0);
  const companionQuests = state.quests.filter(q => q.type === 'companion' && q.companionOwnerId === uid && q.status !== 'rejected');
  const ultimateData = state.companionsData?.ultimates;
  const ultimateReady = !u.companion.ultimateLastUsed || (Date.now() - new Date(u.companion.ultimateLastUsed).getTime()) >= (ultimateData?.cooldownDays || 7) * 24 * 60 * 60 * 1000;
  res.json({
    companion: { ...u.companion, bondInfo },
    quests: companionQuests,
    ultimate: bondInfo.level >= (ultimateData?.requiredBondLevel || 5) ? {
      ready: ultimateReady,
      cooldownDays: ultimateData?.cooldownDays || 7,
      lastUsed: u.companion.ultimateLastUsed || null,
      abilities: ultimateData?.abilities || [],
    } : null,
  });
});

// POST /api/player/:name/companion/pet — pet the companion (bond XP for first 2x/day, unlimited petting)
router.post('/api/player/:name/companion/pet', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(404).json({ error: 'No companion' });

  const today = todayStr();
  if (u.companion.petDateStr !== today) {
    u.companion.petCountToday = 0;
    u.companion.petDateStr = today;
  }

  const petsToday = u.companion.petCountToday || 0;
  const xpLimitReached = petsToday >= 2;

  // Always allow petting, but only award XP for first 2 per day
  if (!xpLimitReached) {
    u.companion.petCountToday = petsToday + 1;
    u.companion.bondXp = (u.companion.bondXp || 0) + 0.5;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  u.companion.lastPetted = now();
  saveUsers();
  const bondInfo = getBondLevel(u.companion.bondXp || 0);
  res.json({
    success: true,
    companion: { ...u.companion, bondInfo },
    petsToday: u.companion.petCountToday || 0,
    xpAwarded: !xpLimitReached,
    message: xpLimitReached ? 'Your companion loves the attention! (XP limit reached for today)' : undefined,
  });
});

// POST /api/player/:name/companion/ultimate — activate companion ultimate ability
router.post('/api/player/:name/companion/ultimate', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(404).json({ error: 'No companion' });

  const bondLevel = u.companion.bondLevel || getBondLevel(u.companion.bondXp || 0).level;
  const ultimateData = state.companionsData?.ultimates;
  if (!ultimateData) return res.status(500).json({ error: 'Ultimates not configured' });
  const requiredLevel = ultimateData.requiredBondLevel || 5;
  if (bondLevel < requiredLevel) {
    return res.status(400).json({ error: `Bond Level ${requiredLevel} benötigt (aktuell: ${bondLevel})` });
  }

  // Check cooldown (7 days)
  const cooldownDays = ultimateData.cooldownDays || 7;
  const lastUsed = u.companion.ultimateLastUsed;
  if (lastUsed) {
    const elapsed = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed < cooldownDays) {
      const remaining = Math.ceil(cooldownDays - elapsed);
      return res.status(429).json({ error: `Ultimate auf Cooldown (noch ${remaining} Tag${remaining > 1 ? 'e' : ''})` });
    }
  }

  const { abilityId, targetQuestId } = req.body;
  if (!abilityId) return res.status(400).json({ error: 'abilityId required' });
  const ability = ultimateData.abilities.find(a => a.id === abilityId);
  if (!ability) return res.status(404).json({ error: 'Unknown ability' });

  let result = { success: true, message: '' };
  const companionName = u.companion.name || 'Dein Begleiter';
  const flavorText = (ability.flavorText || '').replace(/\{name\}/g, companionName);

  switch (ability.effect.type) {
    case 'instant_complete_quest': {
      if (!targetQuestId) return res.status(400).json({ error: 'targetQuestId required for instant_complete' });
      const quest = state.questsById.get(targetQuestId);
      if (!quest) return res.status(404).json({ error: 'Quest not found' });
      if (quest.status !== 'in_progress' && quest.status !== 'open') {
        return res.status(400).json({ error: 'Quest must be open or in progress' });
      }
      // Ownership check: cannot complete another player's claimed quest
      if (quest.claimedBy && quest.claimedBy !== uid) {
        return res.status(403).json({ error: 'Quest gehört einem anderen Spieler' });
      }
      if (quest.status === 'open') {
        quest.status = 'in_progress';
        quest.claimedBy = uid;
        quest.claimedAt = now();
      }
      quest.status = 'completed';
      quest.completedBy = uid;
      quest.completedAt = now();
      quest.proof = `Companion Ultimate: ${companionName}`;
      const newAchs = onQuestCompletedByUser(uid, quest);
      result.message = `${companionName} hat "${quest.title}" für dich erledigt!`;
      result.completedQuest = quest;
      result.newAchievements = newAchs;
      result.xpEarned = u._lastXpEarned;
      result.goldEarned = u._lastGoldEarned;
      // Clean up temp fields to prevent disk persistence
      delete u._lastXpEarned; delete u._lastGoldEarned;
      delete u._lastLoot; delete u._lastCompanionReward;
      break;
    }
    case 'buff': {
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({
        type: ability.effect.buffType,
        questsRemaining: 1,
        activatedAt: now(),
        source: 'companion_ultimate',
      });
      result.message = `Doppelte Belohnung für die nächste Quest aktiviert!`;
      break;
    }
    case 'streak_extend': {
      const days = ability.effect.days || 3;
      u.streakDays = (u.streakDays || 0) + days;
      result.message = `Streak um ${days} Tage verlängert! (Gesamt: ${u.streakDays})`;
      break;
    }
    default:
      return res.status(400).json({ error: `Unknown effect type: ${ability.effect.type}` });
  }

  // Set cooldown
  u.companion.ultimateLastUsed = now();
  saveUsers();
  // Only save quests if we actually modified one
  if (result.completedQuest) {
    const { saveQuests } = require('../lib/state');
    saveQuests();
  }

  res.json({
    ...result,
    flavorText,
    abilityUsed: ability.id,
    cooldownEndsAt: new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString(),
  });
});

// GET /api/cv-export — export skills/certs from completed learning quests
router.get('/api/cv-export', (req, res) => {
  const { userId } = req.query;
  const learningQuests = state.quests.filter(q =>
    q.type === 'learning' &&
    q.status === 'completed' &&
    !q.npcGiverId &&
    (!userId || (q.completedBy && q.completedBy.toLowerCase() === userId.toLowerCase()) || (q.claimedBy && q.claimedBy.toLowerCase() === userId.toLowerCase()))
  );
  const skillMap = {};
  for (const q of learningQuests) {
    const questSkills = Array.isArray(q.skills) && q.skills.length > 0 ? q.skills : [q.title];
    for (const skill of questSkills) {
      if (!skillMap[skill]) skillMap[skill] = { count: 0, quests: [] };
      skillMap[skill].count++;
      skillMap[skill].quests.push({ id: q.id, title: q.title, completedAt: q.completedAt });
    }
  }
  const skills = Object.entries(skillMap)
    .map(([name, data]) => ({ name, count: data.count, lastEarned: data.quests[data.quests.length - 1]?.completedAt || null, quests: data.quests }))
    .sort((a, b) => b.count - a.count);
  const certifications = learningQuests
    .filter(q => q.title && q.title.toLowerCase().includes('cert'))
    .map(q => ({ title: q.title, earnedAt: q.completedAt, questId: q.id }));
  res.json({ userId: userId || 'all', skills, certifications, totalLearningQuests: learningQuests.length, generatedAt: now() });
});

// POST /api/player/:name/favorites — toggle a quest template as favorite
router.post('/api/player/:name/favorites', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(uid);
  const { questId, action } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId required' });
  if (!pp.favorites) pp.favorites = [];
  if (action === 'remove') {
    pp.favorites = pp.favorites.filter(id => id !== questId);
  } else {
    if (!pp.favorites.includes(questId)) pp.favorites.push(questId);
  }
  savePlayerProgress();
  res.json({ ok: true, favorites: pp.favorites });
});

// GET /api/player/:name/favorites — get favorites list
router.get('/api/player/:name/favorites', (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(uid);
  res.json({ favorites: pp.favorites || [] });
});

// GET /api/game-version — get current game version from version.json
router.get('/api/game-version', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const versionFile = path.join(__dirname, '..', 'public', 'data', 'version.json');
    const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    res.json(data);
  } catch { res.json({ version: '1.5.1' }); }
});

// GET /api/changelog-data — get structured changelog from changelog.json
router.get('/api/changelog-data', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const file = path.join(__dirname, '..', 'public', 'data', 'changelog.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch { res.json([]); }
});

// POST /api/player/:name/seen-version — update last seen version
router.post('/api/player/:name/seen-version', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(uid);
  const { version } = req.body;
  if (!version) return res.status(400).json({ error: 'version required' });
  pp.lastSeenVersion = version;
  savePlayerProgress();
  res.json({ ok: true, lastSeenVersion: version });
});

// GET /api/player/:name/seen-version — get last seen version
router.get('/api/player/:name/seen-version', (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(uid);
  res.json({ lastSeenVersion: pp.lastSeenVersion || null });
});

// GET /api/npcs — list all NPC profiles
router.get('/api/npcs', (req, res) => {
  res.json(Object.entries(NPC_META).map(([id, meta]) => ({ id, ...meta })));
});

module.exports = router;
