// ─── Player API ────────────────────────────────────────────────────────────────
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, NPC_META, saveUsers, savePlayerProgress, logActivity, ensureUserCurrencies } = require('../lib/state');
const { now, todayStr, getLevelInfo, getPlayerProgress, calcDynamicForgeTemp, getBondLevel, onQuestCompletedByUser, awardCurrency, rollLoot, addLootToInventory, getGearScore, createPlayerLock } = require('../lib/helpers');
const companionUltimateLock = createPlayerLock('companion-ultimate');
const companionExpeditionLock = createPlayerLock('companion-expedition');
const tavernLock = createPlayerLock('tavern-action');
const { requireAuth, requireSelf } = require('../lib/middleware');

// ─── Companion Expeditions data ─────────────────────────────────────────────
let COMPANION_EXPEDITIONS = { expeditions: [], bondLevelMultiplier: 0.1, cooldownHours: 1 };

function loadCompanionExpeditions() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'companionExpeditions.json');
  try {
    if (fs.existsSync(filePath)) {
      COMPANION_EXPEDITIONS = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      state.companionExpeditionsData = COMPANION_EXPEDITIONS;
      console.log(`[companion-expeditions] Loaded ${COMPANION_EXPEDITIONS.expeditions.length} expeditions`);
    }
  } catch (e) {
    console.warn('[companion-expeditions] Failed to load:', e.message);
  }
}

// PATCH /api/player/:name/profile — update profile settings [auth + self]
router.patch('/api/player/:name/profile', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const { relationshipStatus, partnerName, classId, avatarStyle } = req.body;
  // Avatar style (male/female portrait)
  if (avatarStyle !== undefined) {
    const validStyles = ['male', 'female'];
    if (validStyles.includes(avatarStyle)) u.avatarStyle = avatarStyle;
  }
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

// ─── Notification Center ────────────────────────────────────────────────────
// Aggregates recent events into a unified notification timeline

// GET /api/player/:name/notification-center — unified notification feed
router.get('/api/player/:name/notification-center', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const notifications = [];
  const now = Date.now();
  const cutoff = now - 7 * 86400000; // Last 7 days
  const readSet = new Set(u._notifCenterRead || []);

  // Recent achievements
  if (u.achievements) {
    for (const ach of u.achievements) {
      if (!ach.earnedAt || new Date(ach.earnedAt).getTime() < cutoff) continue;
      notifications.push({
        id: `ach-${ach.id}`, type: "achievement",
        title: ach.name || "Achievement Unlocked",
        message: ach.description || "",
        icon: ach.icon || "/images/icons/nav-honors.png",
        color: "#a855f7",
        at: ach.earnedAt,
        read: readSet.has(`ach-${ach.id}`),
      });
    }
  }

  // Recent quest completions (last 10)
  const completedQuests = state.quests
    .filter(q => q.status === "completed" && q.completedBy?.toLowerCase() === uid && q.completedAt && new Date(q.completedAt).getTime() > cutoff)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);
  for (const q of completedQuests) {
    const rarityColor = { common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f97316" }[q.rarity || "common"] || "#9ca3af";
    notifications.push({
      id: `quest-${q.id}`, type: "quest_milestone",
      title: `Quest Complete: ${q.title}`,
      message: `+${q.rewards?.xp || 0} XP, +${q.rewards?.gold || 0} Gold`,
      icon: "/images/icons/nav-great-hall.png",
      color: rarityColor,
      at: q.completedAt,
      read: readSet.has(`quest-${q.id}`),
    });
  }

  // World boss status
  if (state.store.worldBoss?.active && state.store.worldBoss.boss) {
    const wb = state.store.worldBoss.boss;
    if (!wb.defeated) {
      notifications.push({
        id: `wb-active-${wb.bossId || "current"}`, type: "world_boss_spawn",
        title: `World Boss: ${wb.name || "Unknown"}`,
        message: `HP: ${Math.round((wb.currentHp / wb.maxHp) * 100)}% — Join the fight!`,
        icon: "/images/icons/nav-worldboss.png",
        color: "#ef4444",
        at: wb.spawnedAt || new Date().toISOString(),
        read: readSet.has(`wb-active-${wb.bossId || "current"}`),
      });
    }
  }

  // Pending dungeon invites — social urgency hook
  try {
    const { getActiveDungeons } = require('./dungeons');
    const activeDungeons = getActiveDungeons();
    if (activeDungeons) {
      for (const [runId, run] of Object.entries(activeDungeons)) {
        if (run && run.status === 'forming' && run.invitedPlayers && run.invitedPlayers.includes(uid) && !run.participants.includes(uid)) {
          const creator = state.users[run.createdBy];
          notifications.push({
            id: `dungeon-invite-${runId}`, type: "dungeon_invite",
            title: "Dungeon Invite!",
            message: `${creator?.name || run.createdBy} invited you to a dungeon run`,
            icon: "/images/icons/nav-dungeons.png",
            color: "#60a5fa",
            at: run.createdAt,
            read: readSet.has(`dungeon-invite-${runId}`),
          });
        }
      }
    }
  } catch { /* dungeons module may not be loaded yet */ }

  // Active rift cooldowns ending soon
  const riftState = u.riftState || {};
  for (const [tier, data] of Object.entries(riftState)) {
    if (data && typeof data === "object" && data.cooldownEndsAt) {
      const cdEnd = new Date(data.cooldownEndsAt).getTime();
      if (cdEnd > now && cdEnd - now < 24 * 3600000) {
        notifications.push({
          id: `rift-cd-${tier}`, type: "rift_cooldown",
          title: `Rift ${tier.charAt(0).toUpperCase() + tier.slice(1)} Ready Soon`,
          message: `Cooldown expires in ${Math.ceil((cdEnd - now) / 3600000)}h`,
          icon: "/images/icons/nav-rift.png",
          color: "#818cf8",
          at: data.cooldownEndsAt,
          read: readSet.has(`rift-cd-${tier}`),
        });
      }
    }
  }

  // Sort by date descending, cap at 30
  notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const capped = notifications.slice(0, 30);
  const unreadCount = capped.filter(n => !n.read).length;

  res.json({ notifications: capped, unreadCount });
});

// POST /api/player/:name/notification-center/read — mark all as read
router.post('/api/player/:name/notification-center/read', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  // Store all current notification IDs as read
  const allIds = [];
  // Achievements
  if (u.achievements) for (const ach of u.achievements) allIds.push(`ach-${ach.id}`);
  // Quests
  const completedQuests = state.quests.filter(q => q.status === "completed" && q.completedBy?.toLowerCase() === uid);
  for (const q of completedQuests) allIds.push(`quest-${q.id}`);
  // World boss
  if (state.store.worldBoss?.active && state.store.worldBoss.boss) allIds.push(`wb-active-${state.store.worldBoss.boss.bossId || "current"}`);
  // Rift
  for (const tier of Object.keys(u.riftState || {})) allIds.push(`rift-cd-${tier}`);

  u._notifCenterRead = allIds;
  saveUsers();
  res.json({ ok: true });
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

  // Check if companion is on expedition
  if (u.companionExpedition && !u.companionExpedition.collected) {
    const done = Date.now() >= new Date(u.companionExpedition.completesAt).getTime();
    if (!done) return res.status(400).json({ error: 'Your companion is away on an expedition. Wait for them to return!' });
  }

  const today = todayStr();
  if (u.companion.petDateStr !== today) {
    u.companion.petCountToday = 0;
    u.companion.petDateStr = today;
  }

  const petsToday = u.companion.petCountToday || 0;
  const xpLimitReached = petsToday >= 2;

  // Check if companion is on an active expedition (not yet collected)
  const expedition = u.companionExpedition;
  const onExpedition = expedition && expedition.completesAt && !expedition.collected;

  // Always allow petting, but no bond XP during active expedition or if limit reached
  const prevBondLevel = u.companion.bondLevel || getBondLevel(u.companion.bondXp || 0).level;
  if (!xpLimitReached && !onExpedition) {
    u.companion.petCountToday = petsToday + 1;
    u.companion.bondXp = (u.companion.bondXp || 0) + 0.5;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  const bondLevelUp = u.companion.bondLevel > prevBondLevel;
  u.companion.lastPetted = now();
  // Battle Pass XP (only when bond XP was awarded)
  if (!xpLimitReached && !onExpedition) { try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'companion_pet'); } catch (e) { console.warn('[bp-xp] companion_pet:', e.message); } }
  saveUsers();
  const bondInfo = getBondLevel(u.companion.bondXp || 0);

  // Build expedition message if on expedition
  let expeditionMessage = undefined;
  if (onExpedition) {
    const remaining = new Date(expedition.completesAt).getTime() - Date.now();
    if (remaining > 0) {
      const h = Math.floor(remaining / (1000 * 60 * 60));
      const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      expeditionMessage = `Your companion is on an expedition! Returns in ${h}h ${m}m`;
    }
  }

  res.json({
    success: true,
    companion: { ...u.companion, bondInfo },
    petsToday: u.companion.petCountToday || 0,
    xpAwarded: !xpLimitReached && !onExpedition,
    bondLevelUp: bondLevelUp ? u.companion.bondLevel : null,
    message: onExpedition ? expeditionMessage : (xpLimitReached ? 'Your companion loves the attention! (XP limit reached for today)' : undefined),
  });
});

// POST /api/player/:name/companion/swap — change companion type, retain bond XP/level
router.post('/api/player/:name/companion/swap', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(400).json({ error: 'No companion to swap' });

  // Block swap during active expedition
  if (u.companionExpedition && !u.companionExpedition.collected) {
    const done = Date.now() >= new Date(u.companionExpedition.completesAt).getTime();
    if (!done) return res.status(400).json({ error: 'Your companion is on an expedition. Wait for them to return!' });
  }

  const { type, name, emoji, isReal, species } = req.body;
  if (!type) return res.status(400).json({ error: 'New companion type required' });

  const VALID_VIRTUAL = ['dragon', 'owl', 'phoenix', 'wolf', 'fox', 'bear'];
  const VALID_REAL = ['cat', 'dog', 'hamster', 'bird', 'fish', 'rabbit', 'other'];
  if (!VALID_VIRTUAL.includes(type) && !VALID_REAL.includes(type)) {
    return res.status(400).json({ error: 'Invalid companion type' });
  }

  // Retain bond XP and level — only change appearance/type
  const prevType = u.companion.type;
  const prevName = u.companion.name;
  u.companion.type = type;
  u.companion.name = name || u.companion.name;
  u.companion.emoji = emoji || u.companion.emoji;
  u.companion.isReal = isReal !== undefined ? isReal : VALID_REAL.includes(type);
  u.companion.species = species || type;
  // Bond XP and level are preserved — no reset

  // Cooldown: 7 days between swaps
  const lastSwap = u.companion.lastSwapAt ? new Date(u.companion.lastSwapAt).getTime() : 0;
  const SWAP_COOLDOWN_MS = 7 * 24 * 3600000;
  if (Date.now() - lastSwap < SWAP_COOLDOWN_MS) {
    const daysLeft = Math.ceil((SWAP_COOLDOWN_MS - (Date.now() - lastSwap)) / 86400000);
    return res.status(429).json({ error: `Companion swap on cooldown. ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining.` });
  }
  u.companion.lastSwapAt = now();

  saveUsers();
  console.log(`[companion] ${uid} swapped companion: ${prevType}/${prevName} → ${type}/${u.companion.name} (bond preserved: Lv${u.companion.bondLevel})`);
  res.json({ ok: true, companion: u.companion, message: `Companion changed to ${u.companion.name}! Bond Level ${u.companion.bondLevel} preserved.` });
});

// POST /api/player/:name/companion/ultimate — activate companion ultimate ability
router.post('/api/player/:name/companion/ultimate', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!companionUltimateLock.acquire(uid)) return res.status(429).json({ error: 'Ultimate in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(404).json({ error: 'No companion' });

  // Check if companion is on expedition
  if (u.companionExpedition && !u.companionExpedition.collected) {
    const done = Date.now() >= new Date(u.companionExpedition.completesAt).getTime();
    if (!done) return res.status(400).json({ error: 'Your companion is away on an expedition. Wait for them to return!' });
  }

  const bondLevel = u.companion.bondLevel || getBondLevel(u.companion.bondXp || 0).level;
  const ultimateData = state.companionsData?.ultimates;
  if (!ultimateData) return res.status(500).json({ error: 'Ultimates not configured' });
  const requiredLevel = ultimateData.requiredBondLevel || 5;
  if (bondLevel < requiredLevel) {
    return res.status(400).json({ error: `Bond Level ${requiredLevel} required (current: ${bondLevel})` });
  }

  // Check cooldown (7 days)
  const cooldownDays = ultimateData.cooldownDays || 7;
  const lastUsed = u.companion.ultimateLastUsed;
  if (lastUsed) {
    const elapsed = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed < cooldownDays) {
      const remaining = Math.ceil(cooldownDays - elapsed);
      return res.status(429).json({ error: `Ultimate on cooldown (${remaining} day${remaining > 1 ? 's' : ''} remaining)` });
    }
  }

  const { abilityId, targetQuestId } = req.body;
  if (!abilityId) return res.status(400).json({ error: 'abilityId required' });
  const ability = ultimateData.abilities.find(a => a.id === abilityId);
  if (!ability) return res.status(404).json({ error: 'Unknown ability' });

  let result = { success: true, message: '' };
  const companionName = u.companion.name || 'Your Companion';
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
        return res.status(403).json({ error: 'Quest belongs to another player' });
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
      result.message = `${companionName} completed "${quest.title}" for you!`;
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
      result.message = `Double reward for next quest activated!`;
      break;
    }
    case 'streak_extend': {
      const days = ability.effect.days || 3;
      u.streakDays = (u.streakDays || 0) + days;
      result.message = `Streak extended by ${days} days! (Total: ${u.streakDays})`;
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
  } finally { companionUltimateLock.release(uid); }
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

// GET /api/game-version — cached at startup (no fs.readFileSync per request)
const _versionData = (() => {
  try {
    return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'data', 'version.json'), 'utf8'));
  } catch { return { version: '1.6.0' }; }
})();
router.get('/api/game-version', (req, res) => res.json(_versionData));

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

// ─── Player Search & Public Profile ──────────────────────────────────────────

// GET /api/players/search?q=term — search all players by name (for friend adding, profile browsing)
router.get('/api/players/search', (req, res) => {
  const q = ((req.query.q || '') + '').toLowerCase().trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const agentIds = new Set(Object.keys(state.store.agents || {}));

  // Get all non-agent players
  let players = Object.values(state.users)
    .filter(u => u && u.name && !agentIds.has(u.id))
    .map(u => {
      const lvl = getLevelInfo(u.xp || 0);
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar || u.name[0],
        color: u.color || '#a78bfa',
        level: lvl.level,
        levelTitle: lvl.title,
        xp: u.xp || 0,
        classId: u.classId || null,
        equippedTitle: u.equippedTitle || null,
        questsCompleted: u.questsCompleted || 0,
      };
    });

  // Filter by search query if provided
  if (q) {
    players = players.filter(p => p.name.toLowerCase().includes(q));
  }

  // Sort by XP descending
  players.sort((a, b) => b.xp - a.xp);

  res.json({ players: players.slice(0, limit) });
});

// GET /api/player/:name/public-profile — comprehensive public profile for viewing other players
router.get('/api/player/:name/public-profile', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const lvl = getLevelInfo(u.xp || 0);
  const pp = getPlayerProgress(uid);
  const dynamicForgeTemp = calcDynamicForgeTemp(uid);

  // Equipped gear (public)
  const equipped = {};
  const SLOTS = ['weapon', 'shield', 'helm', 'armor', 'amulet', 'ring', 'boots'];
  for (const slot of SLOTS) {
    const eq = (u.equipment || {})[slot];
    if (eq && typeof eq === 'object') {
      equipped[slot] = { name: eq.name, rarity: eq.rarity, icon: eq.icon || null, stats: eq.stats || {}, slot: eq.slot, setId: eq.setId || null, legendaryEffect: eq.legendaryEffect || null, desc: eq.desc || '' };
    }
  }

  // Achievements (public)
  const achievements = (u.earnedAchievements || []).map(a => ({
    id: a.id, name: a.name, desc: a.desc, icon: a.icon, rarity: a.rarity, points: a.points || 0, earnedAt: a.earnedAt,
  }));

  // Class info
  let classInfo = null;
  if (u.classId) {
    const cls = (state.classesData?.classes || []).find(c => c.id === u.classId);
    if (cls) {
      const classTier = cls.tiers ? [...cls.tiers].reverse().find(t => (u.xp || 0) >= t.minXp) : null;
      classInfo = { id: cls.id, name: cls.fantasy || cls.name, icon: cls.icon, tier: classTier?.title || null };
    }
  }

  // Companion (public)
  let companion = null;
  if (u.companion) {
    const c = u.companion;
    companion = { name: c.name, type: c.type, emoji: c.emoji, isReal: c.isReal, bondLevel: getBondLevel(c.bondXp || 0).level };
  }

  // Professions (public)
  const professions = [];
  if (u.chosenProfessions && u.professions) {
    for (const pid of u.chosenProfessions) {
      const p = u.professions[pid];
      if (p) professions.push({ id: pid, level: p.level || 0, xp: p.xp || 0 });
    }
  }

  // Online status
  const agentEntry = (state.store.agents || {})[uid];
  const agentOnline = agentEntry ? agentEntry.status === 'online' : false;
  const lastActiveAt = u.lastActiveAt || null;
  const msSinceActive = lastActiveAt ? Date.now() - new Date(lastActiveAt).getTime() : Infinity;
  const onlineStatus = agentOnline || msSinceActive < 5 * 60 * 1000 ? 'online' : msSinceActive < 30 * 60 * 1000 ? 'idle' : 'offline';

  // Friendship status (if viewer is authenticated)
  const { resolveAuth } = require('../lib/auth');
  const viewerAuth = resolveAuth(req);
  const viewerId = viewerAuth?.userId?.toLowerCase();
  let friendshipStatus = 'none'; // none | friends | pending_sent | pending_received
  if (viewerId && viewerId !== uid) {
    const sd = state.socialData;
    const isFriend = sd.friendships.some(f =>
      (f.player1 === viewerId && f.player2 === uid) || (f.player1 === uid && f.player2 === viewerId)
    );
    if (isFriend) {
      friendshipStatus = 'friends';
    } else {
      const pendingSent = sd.friendRequests.some(r => r.from === viewerId && r.to === uid && r.status === 'pending');
      const pendingReceived = sd.friendRequests.some(r => r.from === uid && r.to === viewerId && r.status === 'pending');
      if (pendingSent) friendshipStatus = 'pending_sent';
      else if (pendingReceived) friendshipStatus = 'pending_received';
    }
  }

  res.json({
    id: uid,
    name: u.name,
    avatar: u.avatar || u.name[0],
    color: u.color || '#a78bfa',
    level: lvl.level,
    levelTitle: lvl.title,
    xp: u.xp || 0,
    questsCompleted: u.questsCompleted || 0,
    streakDays: u.streakDays || 0,
    forgeTemp: dynamicForgeTemp,
    achievementPoints: u.achievementPoints || 0,
    gold: u.gold || 0,
    equippedTitle: u.equippedTitle || null,
    equippedFrame: u.equippedFrame || null,
    classInfo,
    companion,
    equipped,
    achievements,
    professions,
    onlineStatus,
    lastActiveAt,
    memberSince: u.createdAt || null,
    friendshipStatus,
    gearScore: getGearScore(uid).gearScore,
  });
});

// GET /api/player/:name/profile-data — get profile settings data (frames, etc.)
router.get('/api/player/:name/profile-data', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.usersByName.get(uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({
    unlockedFrames: u.unlockedFrames || [],
    equippedFrame: u.equippedFrame || null,
    relationshipStatus: u.relationshipStatus || 'single',
    partnerName: u.partnerName || null,
    avatarStyle: u.avatarStyle || 'male',
  });
});

// GET /api/npcs — list all NPC profiles
router.get('/api/npcs', (req, res) => {
  res.json(Object.entries(NPC_META).map(([id, meta]) => ({ id, ...meta })));
});

// ─── Collection Log (Unique Named Items) ─────────────────────────────────────

// GET /api/player/:name/collection — get unique items collection log
router.get('/api/player/:name/collection', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const allUniques = state.uniqueItems || [];
  const obtained = new Set(u.collectionLog || []);

  const uniques = allUniques.map(item => {
    const isObtained = obtained.has(item.id);
    return {
      id: item.id,
      name: item.name,
      slot: item.slot,
      rarity: item.rarity,
      tier: item.tier,
      desc: item.desc,
      flavorText: item.flavorText,
      icon: item.icon,
      legendaryEffect: item.legendaryEffect,
      source: item.source,
      obtained: isObtained,
      obtainedAt: isObtained ? (u.collectionLogDates || {})[item.id] || null : undefined,
    };
  });

  const totalFound = obtained.size;
  const totalPossible = allUniques.length;

  res.json({
    uniques,
    totalFound,
    totalPossible,
    completionPercent: totalPossible > 0 ? Math.round((totalFound / totalPossible) * 100) : 0,
  });
});

// ─── Tavern / Rest Mode ──────────────────────────────────────────────────────

// GET /api/tavern/status — get current rest mode status
router.get('/api/tavern/status', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  if (!u) return res.json({ resting: false });

  const rest = u.tavernRest || null;
  if (!rest || !rest.active) {
    // Check cooldown
    const lastRestEnd = rest?.endedAt ? new Date(rest.endedAt).getTime() : 0;
    const cooldownMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const cooldownReady = !lastRestEnd || (Date.now() - lastRestEnd) > cooldownMs;
    const cooldownEndsAt = lastRestEnd ? new Date(lastRestEnd + cooldownMs).toISOString() : null;
    return res.json({
      resting: false,
      canRest: cooldownReady,
      cooldownEndsAt: cooldownReady ? null : cooldownEndsAt,
      history: (u.tavernHistory || []).slice(-5),
    });
  }

  // Check auto-expire (max 7 days)
  const startedAt = new Date(rest.startedAt).getTime();
  const durationMs = (rest.days || 7) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(startedAt + durationMs);
  if (Date.now() > expiresAt.getTime()) {
    // Auto-expire
    rest.active = false;
    rest.endedAt = expiresAt.toISOString();
    rest.autoExpired = true;
    u.tavernHistory = u.tavernHistory || [];
    u.tavernHistory.push({ startedAt: rest.startedAt, endedAt: rest.endedAt, days: rest.days, reason: rest.reason });
    if (u.tavernHistory.length > 20) u.tavernHistory = u.tavernHistory.slice(-20);
    // Grant Welcome Back buff on auto-expire too
    u.activeBuffs = u.activeBuffs || [];
    if (!u.activeBuffs.some(b => b.type === 'xp_boost_25_return' && (b.questsRemaining || 0) > 0)) {
      u.activeBuffs.push({ type: 'xp_boost_25_return', questsRemaining: 50, activatedAt: now(), label: 'Welcome Back — +25% XP' });
    }
    saveUsers();
    return res.json({
      resting: false,
      justExpired: true,
      welcomeBackBuff: true,
      canRest: false,
      cooldownEndsAt: new Date(expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      history: (u.tavernHistory || []).slice(-5),
    });
  }

  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, durationMs - elapsed);

  res.json({
    resting: true,
    startedAt: rest.startedAt,
    days: rest.days,
    reason: rest.reason || null,
    expiresAt: expiresAt.toISOString(),
    remainingMs: remaining,
    remainingDays: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
    streakFrozenAt: rest.streakFrozenAt,
    forgeFrozenAt: rest.forgeFrozenAt,
    history: (u.tavernHistory || []).slice(-5),
  });
});

// POST /api/tavern/enter — enter rest mode
router.post('/api/tavern/enter', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!tavernLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { days = 3, reason } = req.body;
  const restDays = Math.max(1, Math.min(7, parseInt(days, 10) || 3));

  // Check if already resting
  if (u.tavernRest?.active) return res.status(400).json({ error: 'Already resting in the Hearth' });

  // Check cooldown (30 days since last rest ended)
  const lastRestEnd = u.tavernRest?.endedAt ? new Date(u.tavernRest.endedAt).getTime() : 0;
  const cooldownMs = 30 * 24 * 60 * 60 * 1000;
  if (lastRestEnd && (Date.now() - lastRestEnd) < cooldownMs) {
    const cooldownEnds = new Date(lastRestEnd + cooldownMs).toISOString();
    return res.status(429).json({ error: `Rest on cooldown until ${cooldownEnds}`, cooldownEndsAt: cooldownEnds });
  }

  // Freeze streak + forge temp
  u.tavernRest = {
    active: true,
    startedAt: now(),
    days: restDays,
    reason: (reason || '').slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;') || null,
    streakFrozenAt: u.streakDays || 0,
    forgeFrozenAt: u.forgeTemp || 0,
    endedAt: null,
  };

  saveUsers();
  console.log(`[tavern] ${uid} entered rest mode for ${restDays} days`);
  res.json({ ok: true, days: restDays, message: `Entered the Hearth for ${restDays} days. Streaks and forge temp are frozen.` });
  } finally { tavernLock.release(uid); }
});

// POST /api/tavern/leave — leave rest mode early
router.post('/api/tavern/leave', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!tavernLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.tavernRest?.active) return res.status(400).json({ error: 'Not currently resting' });

  u.tavernRest.active = false;
  u.tavernRest.endedAt = now();
  u.tavernHistory = u.tavernHistory || [];
  u.tavernHistory.push({ startedAt: u.tavernRest.startedAt, endedAt: u.tavernRest.endedAt, days: u.tavernRest.days, reason: u.tavernRest.reason });
  if (u.tavernHistory.length > 20) u.tavernHistory = u.tavernHistory.slice(-20);

  // Restore frozen values (use ?? to correctly restore 0 values)
  u.streakDays = u.tavernRest.streakFrozenAt ?? u.streakDays;
  u.forgeTemp = u.tavernRest.forgeFrozenAt ?? u.forgeTemp;

  // Grant "Welcome Back" XP buff — 25% bonus for 7 days
  u.activeBuffs = u.activeBuffs || [];
  u.activeBuffs.push({
    type: 'xp_boost_25_return',
    questsRemaining: 50, // ~7 days worth of quests
    activatedAt: now(),
    label: 'Welcome Back — +25% XP',
  });

  // Talent: tavern_passive_gold — earn gold while resting
  const { getUserTalentEffects } = require('./talent-tree');
  const tavernGoldEffect = getUserTalentEffects(uid).tavern_passive_gold;
  let passiveGoldEarned = 0;
  if (tavernGoldEffect && u.tavernRest.startedAt) {
    const hoursRested = (Date.now() - new Date(u.tavernRest.startedAt).getTime()) / 3600000;
    const maxHours = tavernGoldEffect.maxHoursPerDay || 24;
    const cappedHours = Math.min(hoursRested, maxHours * (u.tavernRest.days || 1));
    passiveGoldEarned = Math.round(cappedHours * (tavernGoldEffect.goldPerHour || 5));
    if (passiveGoldEarned > 0) {
      ensureUserCurrencies(u);
      u.currencies.gold = (u.currencies.gold || 0) + passiveGoldEarned;
      u.gold = u.currencies.gold;
    }
  }

  saveUsers();
  console.log(`[tavern] ${uid} left the Hearth early, granted Welcome Back buff${passiveGoldEarned > 0 ? `, +${passiveGoldEarned}g passive gold` : ''}`);
  res.json({ ok: true, message: `Welcome back. Your streak and forge temp have been restored. +25% XP for your next 50 quests.${passiveGoldEarned > 0 ? ` You earned ${passiveGoldEarned}g while resting.` : ''}`, passiveGoldEarned });
  } finally { tavernLock.release(uid); }
});

// ─── Persistent Seen/Read State ─────────────────────────────────────────────
// Replaces localStorage-based tracking. Survives container restarts + cache clears.
// Categories: items, codex, rooms, suggestions, questIds, npcIds

// GET /api/player/:name/seen — get all seen state
router.get('/api/player/:name/seen', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  res.json(u.seen || {});
});

// POST /api/player/:name/seen — mark items as seen (batch)
// Body: { category: "items"|"codex"|"rooms"|"suggestions"|"questIds"|"npcIds", ids: ["id1", "id2"] }
router.post('/api/player/:name/seen', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { category, ids } = req.body;
  const VALID_CATEGORIES = ['items', 'codex', 'rooms', 'suggestions', 'questIds', 'npcIds'];
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  // Cap batch size to prevent abuse
  const safeIds = ids.slice(0, 500).map(v => String(v).slice(0, 100));

  u.seen = u.seen || {};
  u.seen[category] = u.seen[category] || [];
  const existing = new Set(u.seen[category]);
  let added = 0;
  for (const id of safeIds) {
    if (!existing.has(id)) {
      u.seen[category].push(id);
      existing.add(id);
      added++;
    }
  }
  // Cap stored list at 2000 per category to prevent unbounded growth
  if (u.seen[category].length > 2000) {
    u.seen[category] = u.seen[category].slice(-2000);
  }
  if (added > 0) saveUsers();
  res.json({ ok: true, category, added, total: u.seen[category].length });
});

// ─── Companion Expeditions ──────────────────────────────────────────────────

// GET /api/player/:name/companion/expeditions — list available expeditions + active status
router.get('/api/player/:name/companion/expeditions', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(400).json({ error: 'No companion' });

  const bondLevel = u.companion.bondLevel || getBondLevel(u.companion.bondXp || 0).level;
  const playerLevel = getLevelInfo(u.xp || 0).level;
  const expedition = u.companionExpedition || null;

  // Active expedition info
  let active = null;
  if (expedition && expedition.completesAt && !expedition.collected) {
    const completesAt = new Date(expedition.completesAt).getTime();
    const remaining = Math.max(0, completesAt - Date.now());
    const expDef = COMPANION_EXPEDITIONS.expeditions.find(e => e.id === expedition.expeditionId);
    active = {
      expeditionId: expedition.expeditionId,
      name: expDef?.name || expedition.expeditionId,
      icon: expDef?.icon || '',
      sentAt: expedition.sentAt,
      completesAt: expedition.completesAt,
      remainingMs: remaining,
      completed: remaining <= 0,
    };
  }

  // Cooldown info
  let cooldownRemaining = 0;
  const lastCollectedAt = expedition?.lastCollectedAt;
  if (lastCollectedAt) {
    const cooldownMs = (COMPANION_EXPEDITIONS.cooldownHours || 1) * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(lastCollectedAt).getTime();
    cooldownRemaining = Math.max(0, cooldownMs - elapsed);
  }

  // Available expeditions
  const available = COMPANION_EXPEDITIONS.expeditions.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    durationHours: e.durationHours,
    icon: e.icon,
    rewards: e.rewards,
  }));

  res.json({
    available,
    active,
    cooldownRemainingMs: cooldownRemaining,
    bondLevel,
    bondMultiplier: 1 + bondLevel * (COMPANION_EXPEDITIONS.bondLevelMultiplier || 0.1),
  });
});

// POST /api/player/:name/companion/expedition/send — send companion on expedition
router.post('/api/player/:name/companion/expedition/send', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!companionExpeditionLock.acquire(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(400).json({ error: 'No companion' });

  const { expeditionId } = req.body;
  if (!expeditionId) return res.status(400).json({ error: 'expeditionId required' });

  const expDef = COMPANION_EXPEDITIONS.expeditions.find(e => e.id === expeditionId);
  if (!expDef) return res.status(404).json({ error: 'Unknown expedition' });

  // Check no active expedition (not yet collected)
  const existing = u.companionExpedition;
  if (existing && existing.completesAt && !existing.collected) {
    return res.status(400).json({ error: 'Companion is already on an expedition' });
  }

  // Check cooldown (1h since lastCollectedAt)
  if (existing?.lastCollectedAt) {
    const cooldownMs = (COMPANION_EXPEDITIONS.cooldownHours || 1) * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(existing.lastCollectedAt).getTime();
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / (1000 * 60));
      return res.status(429).json({ error: `Expedition on cooldown (${remaining} min remaining)`, cooldownRemainingMs: cooldownMs - elapsed });
    }
  }

  const sentAt = now();
  const completesAt = new Date(Date.now() + expDef.durationHours * 60 * 60 * 1000).toISOString();

  u.companionExpedition = {
    expeditionId,
    sentAt,
    completesAt,
    collected: false,
    lastCollectedAt: existing?.lastCollectedAt || null,
  };

  saveUsers();
  console.log(`[companion-expedition] ${uid} sent companion on "${expDef.name}" (${expDef.durationHours}h)`);
  res.json({
    ok: true,
    expedition: {
      expeditionId,
      name: expDef.name,
      icon: expDef.icon,
      sentAt,
      completesAt,
      durationHours: expDef.durationHours,
    },
    message: `${u.companion.name || 'Your companion'} set off on "${expDef.name}"! Returns in ${expDef.durationHours}h.`,
  });
  } finally { companionExpeditionLock.release(uid); }
});

// POST /api/player/:name/companion/expedition/collect — collect completed expedition rewards
router.post('/api/player/:name/companion/expedition/collect', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!companionExpeditionLock.acquire(uid)) return res.status(429).json({ error: 'Collect in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(400).json({ error: 'No companion' });

  const expedition = u.companionExpedition;
  if (!expedition || !expedition.completesAt || expedition.collected) {
    return res.status(400).json({ error: 'No active expedition to collect' });
  }

  // Check if expedition has completed
  if (Date.now() < new Date(expedition.completesAt).getTime()) {
    const remaining = new Date(expedition.completesAt).getTime() - Date.now();
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return res.status(400).json({ error: `Expedition not yet complete (${h}h ${m}m remaining)` });
  }

  const expDef = COMPANION_EXPEDITIONS.expeditions.find(e => e.id === expedition.expeditionId);
  if (!expDef) return res.status(500).json({ error: 'Expedition definition not found' });

  // Mark collected FIRST to prevent double-collect race condition
  expedition.collected = true;
  u._expeditionCompletions = (u._expeditionCompletions || 0) + 1;
  expedition.lastCollectedAt = now();

  const bondLevel = u.companion.bondLevel || getBondLevel(u.companion.bondXp || 0).level;
  const bondMultiplier = 1 + bondLevel * (COMPANION_EXPEDITIONS.bondLevelMultiplier || 0.1);
  const playerLevel = getLevelInfo(u.xp || 0).level;
  const rewards = expDef.rewards;
  const collected = {};

  // Helper: roll a range and apply bond multiplier
  function rollRange(range) {
    const [min, max] = range;
    return Math.floor((Math.floor(Math.random() * (max - min + 1)) + min) * bondMultiplier);
  }

  // ── Roll gold ──
  if (rewards.gold) {
    const gold = rollRange(rewards.gold);
    if (gold > 0) { awardCurrency(uid, 'gold', gold); collected.gold = gold; }
  }

  // ── Roll essenz (bond multiplier applied) ──
  if (rewards.essenz) {
    const amount = rollRange(rewards.essenz);
    if (amount > 0) { awardCurrency(uid, 'essenz', amount); collected.essenz = amount; }
  }

  // ── Roll runensplitter (bond multiplier applied) ──
  if (rewards.runensplitter) {
    const amount = rollRange(rewards.runensplitter);
    if (amount > 0) { awardCurrency(uid, 'runensplitter', amount); collected.runensplitter = amount; }
  }

  // ── Roll materials (bond multiplier scales count) ──
  if (rewards.materials && Math.random() < rewards.materials.chance) {
    const [minCount, maxCount] = rewards.materials.count;
    const baseCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    const count = Math.max(1, Math.floor(baseCount * bondMultiplier));
    const allMaterials = state.professionsData?.materials || [];
    if (allMaterials.length > 0) {
      u.craftingMaterials = u.craftingMaterials || {};
      const droppedMaterials = [];
      for (let i = 0; i < count; i++) {
        const mat = allMaterials[Math.floor(Math.random() * allMaterials.length)];
        if (mat && mat.id) {
          u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + 1;
          droppedMaterials.push({ id: mat.id, name: mat.name, rarity: mat.rarity });
        }
      }
      collected.materials = droppedMaterials;
    }
  }

  // ── Roll gems ──
  if (rewards.gems && Math.random() < rewards.gems.chance) {
    const maxTier = rewards.gems.maxTier || 1;
    const allGems = state.gemsData?.gems || [];
    if (allGems.length > 0) {
      const gem = allGems[Math.floor(Math.random() * allGems.length)];
      if (gem && gem.id) {
        const tier = Math.min(maxTier, Math.floor(Math.random() * maxTier) + 1);
        const gemKey = `${gem.id}_${tier}`;
        u.gems = u.gems || {};
        u.gems[gemKey] = (u.gems[gemKey] || 0) + 1;
        collected.gem = { type: gem.id, name: gem.name, tier };
      }
    }
  }

  // ── Roll rare item ──
  if (rewards.rareItem && Math.random() < rewards.rareItem.chance) {
    const loot = rollLoot(1.0, playerLevel);
    if (loot) {
      addLootToInventory(uid, loot);
      collected.rareItem = { name: loot.name, rarity: loot.rarity, slot: loot.slot, icon: loot.icon };
    }
  }

  // Talent: companion_expedition_bond_xp — earn reduced bond XP while companion is on expedition
  const { getUserTalentEffects: getTalentFx } = require('./talent-tree');
  const talentExpBondXp = getTalentFx(uid).companion_expedition_bond_xp;
  if (talentExpBondXp && u.companion) {
    const rate = talentExpBondXp.rate || 0.5;
    const hours = (Date.now() - new Date(expedition.startedAt).getTime()) / 3600000;
    const bondXpGain = Math.round(hours * rate * 0.1); // 0.1 bond XP per hour scaled by rate
    if (bondXpGain > 0) {
      u.companion.bondXp = (u.companion.bondXp || 0) + bondXpGain;
      u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
      collected.expeditionBondXp = bondXpGain;
    }
  }

  // Grant Battle Pass XP (companion_pet source — companion activity)
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'companion_pet'); } catch (e) { console.warn('[bp-xp] companion_pet:', e.message); }

  saveUsers();
  const companionName = u.companion.name || 'Your companion';
  console.log(`[companion-expedition] ${uid} collected rewards from "${expDef.name}"`);

  // Log companion expedition completion to activity feed
  logActivity(uid, 'expedition_complete', {
    expedition: expDef.name,
    companion: companionName,
    tier: expDef.tier || expDef.id,
    gold: collected.gold || 0,
  });

  res.json({
    ok: true,
    expedition: expDef.name,
    bondMultiplier: +bondMultiplier.toFixed(2),
    rewards: collected,
    message: `${companionName} returned from "${expDef.name}" with loot!`,
  });
  } finally { companionExpeditionLock.release(uid); }
});

module.exports = router;
module.exports.loadCompanionExpeditions = loadCompanionExpeditions;
