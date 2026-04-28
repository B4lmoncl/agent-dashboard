const router = require('express').Router();
const crypto = require('crypto');
const { state, XP_BY_PRIORITY, GOLD_BY_PRIORITY, TEMP_BY_PRIORITY, XP_BY_RARITY, GOLD_BY_RARITY, RUNENSPLITTER_BY_RARITY, STREAK_MILESTONES, RARITY_WEIGHTS, RARITY_COLORS, RARITY_ORDER, EQUIPMENT_SLOTS, LEVELS, PLAYER_QUEST_TYPES, saveQuests, saveUsers, savePlayerProgress, saveManagedKeys, rebuildQuestsById, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, getPlayerProgress, getTodayBerlin, awardCurrency, sanitizeAgent, calcDynamicForgeTemp, calcRestedXpPool, getXpMultiplier, getGoldMultiplier, getForgeXpBase, getForgeGoldBase, getKraftBonus, getWeisheitBonus, getUserGear, getQuestHoardingMalus, getLegendaryModifiers, createPlayerLock } = require('../lib/helpers');
const dailyMilestoneLock = createPlayerLock('daily-milestone');
const { requireApiKey, requireAuth, requireMasterKey, getMasterKey } = require('../lib/middleware');
const { assignRarity, selectDailyQuests } = require('../lib/rotation');
const { resolveQuest } = require('../lib/quest-templates');
const { POOL_TYPES, POOL_MIX, getQuestsData } = require('./quests');
const { isWorldBossActive } = require('./world-boss');
const { isDungeonActiveForPlayer } = require('./dungeons');
const { getActiveChallenge, evaluateStageProgress, calculateStageStars, getActiveModifier, getWeeklyData } = require('./challenges-weekly');
const { ensureExpedition, getExpeditionData } = require('./expedition');
const { getTomeUnclaimedCount } = require('./adventure-tome');

// GET /api/config — expose game constants to frontend (no auth required)
router.get('/api/config', (req, res) => {
  res.json({
    xpByPriority:    XP_BY_PRIORITY,
    goldByPriority:  GOLD_BY_PRIORITY,
    tempByPriority:  TEMP_BY_PRIORITY,
    xpByRarity:      XP_BY_RARITY,
    goldByRarity:    GOLD_BY_RARITY,
    forgeTempPerQuest: 10,
    runensplitterByRarity: RUNENSPLITTER_BY_RARITY,
    streakMilestones: STREAK_MILESTONES,
    rarityWeights:   RARITY_WEIGHTS,
    rarityColors:    RARITY_COLORS,
    rarityOrder:     RARITY_ORDER,
    equipmentSlots:  EQUIPMENT_SLOTS,
    levels:          LEVELS,
    playerQuestTypes: PLAYER_QUEST_TYPES,
    // ─── Balance constants (consumed by frontend tooltips/UI) ──────────────
    balance: {
      stats: {
        kraft:    { effect: 0.005, label: "+0.5% XP per point" },
        ausdauer: { effect: 0.005, decayFloor: 0.1, label: "-0.5% Forge Decay per point (floor 10%)" },
        weisheit: { effect: 0.004, label: "+0.4% Gold per point" },
        glueck:   { effect: 0.003, label: "+0.3% Drop Chance per point" },
        fokus:    { effect: 1, cap: 50, label: "+1 flat XP per point (cap 50)" },
        vitalitaet: { effect: 0.01, cap: 0.75, label: "+1% streak protection per point (cap 75%)" },
        charisma: { effect: 0.05, label: "+5% Bond XP per point" },
        tempo:    { effect: 0.01, label: "+1% Forge Temp recovery per point" },
      },
      forgeTemp: {
        tiers: [
          { min: 100, xp: 1.25, gold: 1.25, label: "White-hot" },
          { min: 80,  xp: 1.15, gold: 1.15, label: "Blazing" },
          { min: 60,  xp: 1.10, gold: 1.08, label: "Burning" },
          { min: 40,  xp: 1.0,  gold: 1.0,  label: "Warming" },
          { min: 20,  xp: 0.85, gold: 1.0,  label: "Smoldering" },
          { min: 0,   xp: 0.6,  gold: 1.0,  label: "Cold" },
        ],
        decayPerHour: 2,
        gainPerQuest: 10,
      },
      streak: { bonusPerDay: 0.015, maxBonus: 0.20, softCap: 30 },
      hoarding: { freeLimit: 20, penaltyPerQuest: 10, softCap: 50, hardCap: 80, hardCapAt: 30 },
      gacha: {
        legendaryRate: 0.008,
        epicRate: 0.03,
        rareRate: 0.25,
        uncommonRate: 0.45,
        softPity: 60,
        hardPity: 75,
        softPityIncrease: 0.025,
        epicPity: 10,
      },
      setBonuses: { partial: 0.05, full: 0.10 },
      starBonus: { twoStar: 0.15, threeStar: 0.33 },
      dailyDiminishing: { tiers: [
        { maxQuests: 5, multiplier: 1.0, label: "Full rewards" },
        { maxQuests: 7, multiplier: 0.90, label: "90% rewards" },
        { maxQuests: 10, multiplier: 0.75, label: "75% rewards" },
        { maxQuests: 15, multiplier: 0.60, label: "60% rewards" },
        { maxQuests: 20, multiplier: 0.50, label: "50% rewards" },
        { maxQuests: Infinity, multiplier: 0.25, label: "25% rewards" },
      ]},
    },
  });
});

// GET /api/leaderboard — returns combined leaderboard
// mode=agents: agents only; mode=players: registered users only (default: agents for backward compat)
// GET /api/dashboard?player=X — batch endpoint: returns agents, quests, users,
// leaderboard, achievements, campaigns, rituals, habits, npcs, favorites in one call.
// Reduces 14 separate API calls to 1.
// Uses direct function calls instead of internal HTTP requests for performance.
router.get('/api/dashboard', (req, res) => {
  const playerName = req.query.player || null;
  const playerLower = playerName ? playerName.toLowerCase() : null;

  // ─── Agents (inline from GET /api/agents) ──────────────────────────────────
  const STALE_MS = 30 * 60 * 1000;
  const nowMs = Date.now();
  const agents = Object.values(state.store.agents).map(agent => {
    const copy = sanitizeAgent(agent);
    if (agent.lastUpdate && (nowMs - new Date(agent.lastUpdate).getTime()) > STALE_MS) {
      if (agent.health === 'ok') copy.health = 'stale';
    }
    return copy;
  });

  // ─── Quests (direct call to getQuestsData) ────────────────────────────────
  const quests = getQuestsData(playerLower, null);

  // ─── Users (inline from GET /api/users — no pagination for dashboard) ─────
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const users = Object.values(state.users).map(u => {
    const isRequestingPlayer = playerLower && u.id === playerLower;

    // Non-requesting users: return summary only (saves ~90% payload per user)
    if (!isRequestingPlayer) {
      return {
        id: u.id, name: u.name, xp: u.xp || 0,
        streakDays: u.streakDays || 0, forgeTemp: u.forgeTemp || 0,
        equippedTitle: u.equippedTitle || null,
        equippedFrame: u.equippedFrame || null,
        gearScore: u.gearScore || 0,
        achievementPoints: u.achievementPoints || 0,
        questsCompleted: u.questsCompleted || 0,
        seasonXp: u.seasonXp || 0,
        classId: u.classId || null,
        color: u.color || null,
        avatarStyle: u.avatarStyle || null,
        companion: u.companion ? { name: u.companion.name, type: u.companion.type, bondLevel: u.companion.bondLevel } : null,
        appearance: u.appearance || null,
        avatar: u.avatar || null,
        lastActiveAt: u.lastActiveAt || null,
        earnedAchievements: (u.earnedAchievements || []).map(a => ({ id: a.id, rarity: a.rarity })),
        _isSummary: true,
      };
    }

    const { passwordHash: _ph, apiKey: _ak, refreshTokens: _rt, spotify: _sp, resetToken: _rst, resetTokenExpiry: _rste, emailVerifyToken: _evt, emailVerifyExpiry: _eve, ...safeUser } = u;
    if (Array.isArray(safeUser.earnedAchievements)) {
      safeUser.earnedAchievements = safeUser.earnedAchievements.map(a => {
        const tpl = state.achievementCatalogueById?.get(a.id);
        if (!tpl) return a;
        return { ...a, icon: a.icon || tpl.icon, desc: a.desc || tpl.desc, rarity: a.rarity || tpl.rarity, category: a.category || tpl.category };
      });
    }
    const result = {
      ...safeUser,
      forgeTemp: calcDynamicForgeTemp(u.id),
      equippedTitle: u.equippedTitle || null,
    };
    // Compute expensive modifiers only for the requesting player
    {
      // Live rested XP pool (stale snapshot → live calculation, like calcDynamicForgeTemp)
      result._restedXpPool = calcRestedXpPool(u.id);
      const forgeXpPure = getForgeXpBase(u.id);
      const kraftBonus = getKraftBonus(u.id);
      const forgeXp = getXpMultiplier(u.id);
      const forgeGoldPure = getForgeGoldBase(u.id);
      const weisheitBonus = getWeisheitBonus(u.id);
      const forgeGold = getGoldMultiplier(u.id);
      const gear = getUserGear(u.id);
      const gearBonus = 1 + (gear.xpBonus || 0) / 100;
      const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
      const compBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
      const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
      const streakGold = Math.min(1 + (u.streakDays || 0) * 0.015, 1.45);
      const hoarding = getQuestHoardingMalus(u.id);
      const legendaryMods = getLegendaryModifiers(u.id);
      // D3-style bucket display: additive within bucket, multiplicative between
      const xpGearBucket = 1 + (gear.xpBonus || 0) / 100;
      const xpCompBucket = 1 + (compBonus - 1) + (bondBonus - 1);
      const xpEquipBucket = 1 + ((legendaryMods.xpBonus || 1) - 1);
      result.modifiers = {
        xp: { forge: forgeXp, gearBucket: xpGearBucket, companionBucket: xpCompBucket, equipBucket: xpEquipBucket, hoarding: hoarding.multiplier, hoardingCount: hoarding.count, hoardingPct: hoarding.malusPct, total: +(forgeXp * xpGearBucket * xpCompBucket * hoarding.multiplier * xpEquipBucket).toFixed(2) },
        gold: { forge: forgeGold, streak: streakGold, legendary: legendaryMods.goldBonus, total: +(forgeGold * streakGold * legendaryMods.goldBonus).toFixed(2) },
      };
    }
    return result;
  });

  // ─── Achievements (inline from GET /api/achievements) ─────────────────────
  const achievements = {
    achievements: state.ACHIEVEMENT_CATALOGUE.map(a => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, category: a.category, rarity: a.rarity, points: a.points || 5, hidden: !!a.hidden, condition: a.condition || null, chainId: a.chainId || null, chainTier: a.chainTier || null })),
    pointMilestones: state.achievementMilestones || [],
  };

  // ─── Campaigns (inline from GET /api/campaigns) ───────────────────────────
  const campaigns = state.campaigns.map(c => {
    const questDetails = c.questIds.map(id => {
      const q = state.questsById.get(id);
      if (!q) return { id, title: '(deleted)', status: 'deleted' };
      return { id: q.id, title: q.title, status: q.status, type: q.type,
               completedBy: q.completedBy, completedAt: q.completedAt, claimedBy: q.claimedBy,
               lore: q.lore || null, description: q.description };
    });
    const completed = questDetails.filter(q => q.status === 'completed').length;
    return { ...c, quests: questDetails, progress: { completed, total: questDetails.length } };
  });

  // ─── NPCs/Active (inline from GET /api/npcs/active) ──────────────────────
  const npcNow = new Date();
  const playerNpcQuests = playerLower ? (getPlayerProgress(playerLower).npcQuests || {}) : null;
  const activeNpcs = state.npcState.activeNpcs
    .filter(a => {
      const dep = a.departureTime || a.expiresAt;
      return new Date(dep) > npcNow;
    })
    .map(active => {
      const giver = state.npcGivers.givers.find(g => g.id === active.giverId);
      if (!giver) return null;
      const questIds = state.npcState.npcQuestIds[active.giverId] || [];
      const npcQuests = questIds.map(id => state.questsById.get(id)).filter(Boolean);
      const depTime = active.departureTime || active.expiresAt;
      const msLeft = new Date(depTime) - npcNow;
      return {
        id: giver.id,
        name: giver.name,
        emoji: giver.emoji,
        title: giver.title,
        description: giver.description,
        portrait: giver.portrait || null,
        greeting: giver.greeting || null,
        rarity: giver.rarity || 'common',
        arrivedAt: active.arrivedAt,
        departureTime: depTime,
        expiresAt: active.expiresAt,
        daysLeft: Math.max(0, Math.ceil(msLeft / 86400000)),
        hoursLeft: Math.max(0, Math.ceil(msLeft / 3600000)),
        finalReward: giver.finalReward,
        questChain: questIds.map((qid, idx) => {
          const q = npcQuests.find(x => x.id === qid);
          if (!q) return null;
          let status, claimedBy, completedBy;
          if (playerNpcQuests) {
            const playerStatus = playerNpcQuests[qid];
            if (playerStatus) {
              status = playerStatus.status;
              claimedBy = playerStatus.status === 'in_progress' ? playerLower : (playerStatus.completedBy || null);
              completedBy = playerStatus.completedBy || null;
            } else {
              if (idx > 0) {
                const prevQid = questIds[idx - 1];
                const prevStatus = playerNpcQuests[prevQid];
                status = (prevStatus && prevStatus.status === 'completed') ? 'open' : 'locked';
              } else {
                status = 'open';
              }
              claimedBy = null;
              completedBy = null;
            }
          } else {
            status = idx === 0 ? 'open' : 'locked';
            claimedBy = null;
            completedBy = null;
          }
          return {
            questId: q.id,
            title: q.title,
            description: q.description,
            type: q.type,
            status,
            claimedBy,
            completedBy,
            rewards: q.npcRewards,
            position: idx + 1,
            flavorText: q.flavorText || null,
          };
        }).filter(Boolean),
      };
    }).filter(Boolean);

  // ─── Weekly Challenge (inline from GET /api/weekly-challenge) ──────────────
  let weeklyChallenge = null;
  if (playerLower) {
    const u = playerLower ? state.usersByName.get(playerLower) : null;
    if (u) {
      const challenge = getActiveChallenge(u.id);
      if (challenge && challenge.template) {
        const WEEKLY_DATA = getWeeklyData();
        const stageRewards = WEEKLY_DATA.weeklyChallenge?.stageRewards || {};
        const modifier = getActiveModifier(challenge.weekId);
        const canAdvance = evaluateStageProgress(u.id, challenge);
        const stageStars = (challenge.template.stages || []).map((s, i) => {
          if (challenge.completedStages.includes(i + 1)) {
            return challenge.stars[i] || 0;
          }
          if (i === challenge.currentStage) {
            return calculateStageStars(s, challenge.progress, u, challenge.stageStartedAt[i], modifier);
          }
          return 0;
        });
        const totalStars = stageStars.reduce((sum, s) => sum + s, 0);
        weeklyChallenge = {
          weekId: challenge.weekId,
          templateId: challenge.templateId,
          name: challenge.template.name,
          icon: challenge.template.icon,
          stages: (challenge.template.stages || []).map((s, i) => ({
            ...s,
            completed: challenge.completedStages.includes(i + 1),
            current: i === challenge.currentStage,
            rewards: stageRewards[String(i + 1)] || {},
            earnedStars: stageStars[i],
          })),
          currentStage: challenge.currentStage,
          progress: challenge.progress,
          canAdvance,
          startedAt: challenge.startedAt,
          stageStartedAt: challenge.stageStartedAt,
          stars: stageStars,
          totalStars,
          claimedMilestones: u.weeklyChallenge.claimedMilestones || [],
          modifier,
          speedBonusDays: WEEKLY_DATA.weeklyChallenge?.speedBonusDays || 2,
          streakDays: u.streakDays || 0,
        };
      }
    }
  }

  // ─── Expedition (inline from GET /api/expedition) ─────────────────────────
  let expeditionResult = null;
  {
    const exp = ensureExpedition();
    if (exp) {
      const EXPEDITION_DATA = getExpeditionData();
      const template = (EXPEDITION_DATA.expedition?.templates || []).find(t => t.id === exp.templateId);
      if (template) {
        const expUser = playerLower ? state.usersByName.get(playerLower) : null;
        const rewards = EXPEDITION_DATA.expedition?.checkpointRewards || {};
        const bonusTitles = EXPEDITION_DATA.expedition?.bonusTitles || [];
        const weekSeed = parseInt(exp.weekId.replace(/\D/g, ''), 10);
        const bonusTitle = bonusTitles.length > 0 ? bonusTitles[weekSeed % bonusTitles.length] : null;
        const totalCheckpoints = exp.totalRequired.length;
        const checkpoints = exp.totalRequired.map((required, i) => {
          const cpNum = i + 1;
          const isBonus = cpNum === totalCheckpoints;
          const rewardKey = isBonus ? 'bonus' : String(cpNum);
          return {
            number: cpNum,
            name: template.checkpointNames[i] || `Checkpoint ${cpNum}`,
            flavor: (template.checkpointFlavor || [])[i] || null,
            required,
            reached: exp.checkpointsReached.includes(cpNum),
            rewards: rewards[rewardKey] || {},
            isBonus,
            bonusTitle: isBonus ? bonusTitle : null,
            claimedByPlayer: expUser ? (exp.claimedRewards[expUser.id] || []).includes(cpNum) : false,
          };
        });
        const contributions = Object.entries(exp.contributions)
          .map(([userId, count]) => {
            const user = state.users[userId];
            return { userId, name: user?.name || userId, avatar: user?.avatar || '??', color: user?.color || '#888', count };
          })
          .sort((a, b) => b.count - a.count);
        expeditionResult = {
          weekId: exp.weekId,
          templateId: exp.templateId,
          name: template.name,
          description: template.description,
          icon: template.icon,
          progress: exp.progress,
          playerCount: exp.playerCount,
          checkpoints,
          contributions,
          playerContribution: expUser ? (exp.contributions[expUser.id] || 0) : 0,
          startedAt: exp.startedAt,
          progressMessages: template.progressMessages || null,
        };
      }
    }
  }

  // Player-specific lightweight data (direct state access — no complex logic)
  let rituals = [];
  let habits = [];
  let favorites = [];
  if (playerLower) {
    rituals = (state.rituals || []).filter(r => r.playerId === playerLower && !r.isAntiRitual);
    habits = state.habits.filter(h => h.playerId === playerLower);
    const u = state.users[playerLower];
    const pp = state.playerProgress[playerLower];
    favorites = pp?.favorites || [];
  }

  // Daily bonus status (lightweight — direct state access)
  let dailyBonusAvailable = false;
  if (playerLower) {
    const u = state.users[playerLower];
    if (u) {
      const todayBerlin = getTodayBerlin();
      dailyBonusAvailable = u.dailyBonusLastClaim !== todayBerlin;
    }
  }

  // Social summary (lightweight counts for badge indicators)
  let socialSummary = null;
  if (playerLower) {
    const sd = state.socialData;
    const pendingFriendRequests = sd.friendRequests.filter(r => r.to === playerLower && r.status === 'pending').length;
    const unreadMessages = sd.messages.filter(m => m.to === playerLower && !m.read).length;
    const activeTrades = sd.trades.filter(t =>
      (t.initiator === playerLower || t.recipient === playerLower) &&
      (t.status === 'pending_initiator' || t.status === 'pending_recipient')
    ).length;
    const pendingBonds = (sd.swornBonds || []).filter(b => b.player2 === playerLower && b.status === 'pending').length;
    // Sworn bond summary for at-a-glance display
    let swornBondSummary = null;
    const activeBond = (sd.swornBonds || []).find(b => b.status === 'active' && (b.player1 === playerLower || b.player2 === playerLower));
    if (activeBond) {
      try { const { ensureBondWeeklyObjective } = require('./sworn-bonds'); ensureBondWeeklyObjective?.(activeBond); } catch { /* not loaded yet */ }
      const isP1 = activeBond.player1 === playerLower;
      const partnerId = isP1 ? activeBond.player2 : activeBond.player1;
      const partner = state.users[partnerId];
      const obj = activeBond.weeklyObjective;
      swornBondSummary = {
        bondId: activeBond.id,
        partnerName: partner?.name || partnerId,
        streak: activeBond.streak || 0,
        bondLevel: activeBond.bondLevel || 1,
        objectiveCompleted: obj?.completed || false,
        chestReady: obj?.completed && !(isP1 ? obj.chestClaimed?.player1 : obj.chestClaimed?.player2),
      };
    }
    socialSummary = { pendingFriendRequests, unreadMessages, activeTrades, pendingBonds, swornBondSummary };
  }

  // Daily missions — computed from existing player actions (no new storage needed)
  let dailyMissions = null;
  if (playerLower) {
    const u = state.users[playerLower];
    if (u) {
      const today = getTodayBerlin();
      const pp = state.playerProgress[playerLower] || {};
      // Count quests completed today (cq.at is ISO timestamp — compare date portion in Berlin TZ)
      const questsToday = (u._dailyCompletions?.date === today ? u._dailyCompletions.count : 0) || Object.values(pp.completedQuests || {}).filter(cq => cq && cq.at && cq.at.startsWith(today)).length;
      // Check daily bonus claimed
      const dailyClaimed = u.dailyBonusLastClaim === today;
      // Check rituals completed today
      const ritualsToday = (state.rituals || []).filter(r => r.playerId === playerLower && r.lastCompleted === today).length;
      // Check companion petted today (petCountToday is only reset on next pet, so verify date)
      const petCount = (u.companion?.petDateStr === today) ? (u.companion.petCountToday ?? 0) : 0;
      // Check crafted today
      const craftedToday = u.lastCraftDate === today;
      // Build mission list with points
      const missions = [
        { id: 'login', label: 'Claim Daily Bonus', points: 100, done: dailyClaimed },
        { id: 'quest1', label: 'Complete 1 Quest', points: 150, done: questsToday >= 1 },
        { id: 'quest3', label: 'Complete 3 Quests', points: 250, done: questsToday >= 3 },
        { id: 'ritual', label: 'Complete a Ritual', points: 100, done: ritualsToday >= 1 },
        { id: 'pet', label: 'Pet your Companion', points: 50, done: petCount >= 1 },
        { id: 'craft', label: 'Craft an Item', points: 100, done: craftedToday },
      ];
      // Talent: daily_mission_extra_slot — adds bonus mission(s)
      const { getUserTalentEffects } = require('./talent-tree');
      const dailyExtraSlot = getUserTalentEffects(playerLower).daily_mission_extra_slot;
      if (dailyExtraSlot && dailyExtraSlot.extraSlots >= 1) {
        const extraPoints = Math.round((dailyExtraSlot.pointModifier || 0.5) * 150);
        missions.push({ id: 'quest5', label: 'Complete 5 Quests', points: extraPoints, done: questsToday >= 5 });
      }
      const earned = missions.filter(m => m.done).reduce((sum, m) => sum + m.points, 0);
      const totalPoints = missions.reduce((sum, m) => sum + m.points, 0);
      const milestones = [
        { threshold: 100, reward: { gold: 10 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(100) },
        { threshold: 300, reward: { gold: 20, essenz: 3 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(300) },
        { threshold: 500, reward: { gold: 35, runensplitter: 2 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(500) },
        { threshold: 750, reward: { gold: 50, sternentaler: 1 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(750) },
      ];
      dailyMissions = { missions, earned, total: totalPoints, milestones };
    }
  }

  // ─── Notification badge aggregation (lightweight state access) ────────────
  let notifications = null;
  if (playerLower) {
    const u = state.users[playerLower];
    if (u) {
      // Unclaimed daily milestones
      const dm = dailyMissions;
      const unclaimedMilestones = dm ? dm.milestones.filter(m => dm.earned >= m.threshold && !m.claimed).length : 0;

      // Unread mail
      const mailbox = u.mailbox || [];
      const unreadMail = mailbox.filter(m => !m.read).length;
      const uncollectedMail = mailbox.filter(m => !m.collected && ((m.gold || 0) > 0 || (m.items || []).length > 0)).length;

      // Companion expedition completed
      const compExp = u.companionExpedition;
      const expeditionReady = compExp && !compExp.collected && compExp.completesAt && new Date(compExp.completesAt).getTime() <= Date.now() ? 1 : 0;

      // World boss claimable
      const wbClaimable = (() => {
        try {
          const wbState = require('./world-boss').getWorldBossState?.();
          if (!wbState?.boss?.defeated) return 0;
          const claimed = wbState.boss.rewardsClaimed || [];
          const contributed = (wbState.boss.contributions || []).some(c => c.playerId === playerLower);
          return contributed && !claimed.includes(playerLower) ? 1 : 0;
        } catch { return 0; }
      })();

      // Battle Pass unclaimed levels
      let bpUnclaimed = 0;
      try {
        const { getActiveSeason, getBPLevel } = require('./battlepass');
        if (getActiveSeason && u.battlePass) {
          const bpLevel = getBPLevel(u.battlePass.xp || 0);
          const claimed = u.battlePass.claimedLevels || [];
          for (let l = 1; l <= bpLevel; l++) { if (!claimed.includes(l)) bpUnclaimed++; }
        }
      } catch { /* battlepass not loaded */ }

      // Faction unclaimed tier rewards
      let factionUnclaimed = 0;
      if (u.factions) {
        const FACTION_TIERS = [
          { id: 'friendly', minRep: 500 }, { id: 'honored', minRep: 1500 },
          { id: 'revered', minRep: 4000 }, { id: 'exalted', minRep: 8000 }, { id: 'paragon', minRep: 15000 },
        ];
        for (const [, fData] of Object.entries(u.factions)) {
          if (!fData || typeof fData !== 'object') continue;
          const rep = fData.rep || 0;
          const claimed = fData.claimedRewards || [];
          for (const tier of FACTION_TIERS) {
            if (rep >= tier.minRep && !claimed.includes(tier.id)) factionUnclaimed++;
          }
        }
      }

      // Pending social (already computed above)
      const social = socialSummary || { pendingFriendRequests: 0, unreadMessages: 0, activeTrades: 0 };

      // Challenge unclaimed star milestones (from already-computed weeklyChallenge)
      let challengeUnclaimed = 0;
      if (weeklyChallenge) {
        const STAR_MILESTONE_THRESHOLDS = [3, 6, 9];
        const claimed = weeklyChallenge.claimedMilestones || [];
        for (const t of STAR_MILESTONE_THRESHOLDS) {
          if (weeklyChallenge.totalStars >= t && !claimed.includes(t)) challengeUnclaimed++;
        }
      }

      // Forge fever active (getForgeFever returns null if expired)
      let forgeFeverActive = 0;
      try {
        const { getForgeFever: getFF } = require('./crafting');
        if (typeof getFF === 'function' && getFF()) forgeFeverActive = 1;
      } catch { /* crafting module not loaded */ }

      // Adventure Tome unclaimed milestones
      let tomeUnclaimed = 0;
      try {
        tomeUnclaimed = getTomeUnclaimedCount(u);
      } catch { /* tome not loaded */ }

      notifications = {
        dailyBonus: dailyBonusAvailable ? 1 : 0,
        unclaimedMilestones,
        unreadMail,
        uncollectedMail,
        expeditionReady,
        wbClaimable,
        bpUnclaimed,
        factionUnclaimed,
        challengeUnclaimed,
        forgeFeverActive,
        tomeUnclaimed,
        pendingFriendRequests: social.pendingFriendRequests,
        unreadMessages: social.unreadMessages,
        activeTrades: social.activeTrades,
        pendingBonds: social.pendingBonds || 0,
        bondChestReady: social.swornBondSummary?.chestReady ? 1 : 0,
      };
    }
  }

  res.json({
    agents,
    quests: quests || { open: [], inProgress: [], completed: [], suggested: [], rejected: [] },
    users,
    achievements,
    campaigns,
    rituals,
    habits,
    favorites,
    activeNpcs,
    dailyBonusAvailable,
    weeklyChallenge: weeklyChallenge || null,
    expedition: expeditionResult || null,
    socialSummary,
    dailyMissions,
    // Lightweight active-content status for Today drawer (uses in-memory state, no FS I/O)
    worldBossActive: isWorldBossActive(),
    riftActive: (() => {
      if (!playerLower) return false;
      const u = state.users[playerLower];
      if (!u?.activeRift?.active || u.activeRift.completed || u.activeRift.failed) return false;
      // expiresAt is NOT stored on rift — compute from startedAt + timeLimitHours
      const RIFT_TIME_LIMITS = { normal: 72, hard: 48, legendary: 36, mythic: 30 };
      const tl = u.activeRift.timeLimitHours || RIFT_TIME_LIMITS[u.activeRift.tier] || 72;
      const expiresAt = new Date(u.activeRift.startedAt).getTime() + tl * 3600000;
      return expiresAt > Date.now();
    })(),
    dungeonActive: isDungeonActiveForPlayer(playerLower),
    notifications,
    seen: playerLower ? (state.users[playerLower]?.seen || {}) : null,
    apiLive: true,
  });
});

// POST /api/daily-missions/claim — claim a milestone reward
router.post('/api/daily-missions/claim', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!dailyMilestoneLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { threshold } = req.body;
  const validThresholds = [100, 300, 500, 750];
  if (!validThresholds.includes(threshold)) return res.status(400).json({ error: 'Invalid threshold' });

  const today = getTodayBerlin();
  u.dailyMilestonesClaimed = u.dailyMilestonesClaimed || {};
  u.dailyMilestonesClaimed[today] = u.dailyMilestonesClaimed[today] || [];
  if (u.dailyMilestonesClaimed[today].includes(threshold)) {
    return res.status(409).json({ error: 'Milestone already claimed' });
  }

  // Verify earned points meet threshold
  const pp = state.playerProgress[uid] || {};
  const questsToday = Object.values(pp.completedQuests || {}).filter(cq => cq && cq.at && cq.at.startsWith(today)).length;
  const dailyClaimed = u.dailyBonusLastClaim === today;
  const ritualsToday = (state.rituals || []).filter(r => r.playerId === uid && r.lastCompleted === today).length;
  const petCount = (u.companion?.petDateStr === today) ? (u.companion.petCountToday ?? 0) : 0;
  const craftedToday = u.lastCraftDate === today;
  const missions = [
    { points: 100, done: dailyClaimed },
    { points: 150, done: questsToday >= 1 },
    { points: 250, done: questsToday >= 3 },
    { points: 100, done: ritualsToday >= 1 },
    { points: 50, done: petCount >= 1 },
    { points: 100, done: craftedToday },
  ];
  const earned = missions.filter(m => m.done).reduce((sum, m) => sum + m.points, 0);
  if (earned < threshold) return res.status(400).json({ error: 'Not enough activity points' });

  // Award reward
  const rewards = { 100: { gold: 25 }, 300: { gold: 50, essenz: 3 }, 500: { gold: 100, runensplitter: 2 }, 750: { gold: 150, sternentaler: 1 } };
  const reward = rewards[threshold] || {};
  ensureUserCurrencies(u);
  for (const [currency, amount] of Object.entries(reward)) {
    awardCurrency(uid, currency, amount);
  }
  u.dailyMilestonesClaimed[today].push(threshold);

  // Perfect Day bonus: claiming the 750 milestone grants +50% XP on next quest
  let perfectDayBonus = false;
  if (threshold === 750) {
    u.activeBuffs = u.activeBuffs || [];
    u.activeBuffs.push({ type: 'xp_boost_50_perfect', questsRemaining: 1, activatedAt: now(), label: 'Perfect Day — +50% XP on next quest' });
    perfectDayBonus = true;
  }

  // Prune old daily milestone claims (keep last 7 days)
  const dates = Object.keys(u.dailyMilestonesClaimed).sort();
  while (dates.length > 7) {
    delete u.dailyMilestonesClaimed[dates.shift()];
  }

  // Battle Pass XP
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'daily_mission_milestone', { points: threshold }); } catch (e) { console.warn('[bp-xp] daily_mission_milestone:', e.message); }

  saveUsers();
  res.json({ success: true, reward, earned, perfectDayBonus });
  } finally { dailyMilestoneLock.release(uid); }
});

router.get('/api/leaderboard', (req, res) => {
  const seasonal = req.query.seasonal === 'true';
  const xpField = seasonal ? 'seasonXp' : 'xp';
  const agentIds = new Set(Object.keys(state.store.agents));

  // Build agents-only ranked list
  const agentsRanked = Object.values(state.store.agents)
    .map(a => {
      const levelInfo = getLevelInfo(a.xp || 0);
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        color: a.color,
        role: a.role,
        xp: a.xp || 0,
        questsCompleted: a.questsCompleted || 0,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        isAgent: true,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  // Build players-only ranked list (registered users, exclude agent IDs)
  const playersRanked = Object.values(state.users)
    .filter(u => !agentIds.has(u.id))
    .map(u => {
      const levelInfo = getLevelInfo(u.xp || 0);
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        color: u.color,
        role: null,
        xp: seasonal ? (u.seasonXp || 0) : (u.xp || 0),
        questsCompleted: u.questsCompleted || 0,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        isAgent: false,
        seasonal,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  // Return combined list with agents first for backward compat (client separates via isAgent)
  res.json([...agentsRanked, ...playersRanked]);
});

// ─── Quest Pool System ─────────────────────────────────────────────────────────
// Per-player quest pool. Refresh generates 18 NEW quests from templates (per player),
// then picks ~10 for the visible "Open" tab.

// POOL_TYPES and POOL_MIX imported from routes/quests.js (single source of truth)

function buildVisiblePool(playerName, playerLevel) {
  const uid = playerName.toLowerCase();
  const pp = getPlayerProgress(uid);
  const userRecord = state.users[uid];
  // Exclude quests already claimed (in progress)
  const claimedIds = new Set((userRecord?.openQuests || []).map(q => typeof q === 'string' ? q : q.id));
  const pool = [];

  // Pick from this player's generated quest pool (pp.generatedQuests)
  const generated = (pp.generatedQuests || [])
    .map(id => state.questsById.get(id))
    .filter(q => q && q.status === 'open' && !claimedIds.has(q.id) && (!q.minLevel || q.minLevel <= playerLevel));

  for (const type of POOL_TYPES) {
    const target = POOL_MIX[type] || 1;
    const candidates = generated.filter(q => q.type === type);
    // Fisher-Yates shuffle (unbiased)
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < Math.min(target, shuffled.length); i++) {
      pool.push(shuffled[i].id);
    }
  }
  // Talent tree: quest_pool_size — increases visible quest pool
  const { getUserTalentEffects } = require('./talent-tree');
  const talentPoolBonus = getUserTalentEffects(uid).quest_pool_size || 0;
  return pool.slice(0, 11 + talentPoolBonus);
}

// Generate 18 fresh quests from templates for a specific player
function generatePlayerQuests(playerName, playerLevel) {
  const uid = playerName.toLowerCase();
  const pp = getPlayerProgress(uid);
  const userRecord = state.users[uid];
  const todayStr = getTodayBerlin();

  // Collect IDs to exclude: claimed + completed today + current generated pool
  const claimedIds = new Set((userRecord?.openQuests || []).map(q => typeof q === 'string' ? q : q.id));
  const completedTodayIds = new Set();
  for (const [qid, info] of Object.entries(pp.completedQuests || {})) {
    const doneAt = info?.completedAt || info;
    if (typeof doneAt === 'string' && doneAt.startsWith(todayStr)) {
      completedTodayIds.add(qid);
    }
  }
  // Also exclude templateIds of claimed + completed-today quests
  const excludeTemplateIds = new Set();
  for (const q of state.quests) {
    if (claimedIds.has(q.id) || completedTodayIds.has(q.id)) {
      if (q.templateId) excludeTemplateIds.add(q.templateId);
    }
  }
  // Also exclude templateIds of current generated pool (if any still open)
  for (const qid of (pp.generatedQuests || [])) {
    const q = state.questsById.get(qid);
    if (q && q.templateId) excludeTemplateIds.add(q.templateId);
  }

  const catalog = state.questCatalog.templates || [];
  const templates = catalog.filter(t =>
    t.category !== 'companion' && t.createdBy !== 'companion' && !excludeTemplateIds.has(t.id) &&
    (t.minLevel || 1) <= playerLevel
  );

  if (templates.length === 0) {
    console.warn(`[Quest Pool] No available templates for ${uid} (${excludeTemplateIds.size} excluded)`);
    return [];
  }

  const daySeed = Date.now() + uid.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const dailyTemplates = selectDailyQuests(templates, {
    count: 18,
    typeDistribution: { personal: 5, fitness: 4, learning: 4, social: 3, boss: 2 },
    previousIds: pp.previousTemplateIds || [],
    daySeed,
  });

  const REWARDS_BY_RARITY = {
    common:    { xp: 10, gold: 8  },
    uncommon:  { xp: 18, gold: 14 },
    rare:      { xp: 30, gold: 24 },
    epic:      { xp: 50, gold: 40 },
    legendary: { xp: 80, gold: 65 },
  };
  const newQuests = dailyTemplates.map((t, i) => {
    const resolved = resolveQuest(t);
    const rarity = assignRarity(t);
    return {
      id: `quest-${uid}-${Date.now()}-${String(i + 1).padStart(3, '0')}`,
      title: resolved.title || t.title,
      description: resolved.description || t.description,
      type: resolved.type || t.type || 'personal',
      categories: t.category ? [t.category] : [],
      product: null, humanInputRequired: false,
      createdBy: 'system', status: 'open',
      createdAt: new Date().toISOString(),
      claimedBy: null, completedBy: null, completedAt: null,
      parentQuestId: null, recurrence: t.recurrence || null,
      streak: 0, lastCompletedAt: null,
      proof: null, checklist: null, nextQuestTemplate: null,
      coopPartners: null, coopClaimed: [], coopCompletions: [],
      skills: t.tags || [], lore: resolved.lore || t.lore || null,
      chapter: t.chainId || null, minLevel: t.minLevel || 1,
      classRequired: t.classId || null,
      requiresRelationship: t.requiresRelationship || false,
      rarity,
      difficulty: (t.vars && t.vars.difficulty) || t.difficulty || 'starter',
      flavorText: resolved.flavorText || null,
      rewards: REWARDS_BY_RARITY[rarity] || resolved.rewards || { xp: 20, gold: 10 },
      templateId: t.id,
    };
  });

  // Remove old generated quests that are still 'open' (not claimed)
  const oldGenIds = new Set(pp.generatedQuests || []);
  state.quests = state.quests.filter(q => !oldGenIds.has(q.id) || q.status !== 'open');
  rebuildQuestsById();

  // Add new quests
  state.quests.push(...newQuests);
  for (const q of newQuests) state.questsById.set(q.id, q);
  saveQuests();

  // Track generated IDs and previous template IDs
  pp.generatedQuests = newQuests.map(q => q.id);
  pp.previousTemplateIds = dailyTemplates.map(t => t.id);

  console.log(`[Quest Pool] Generated ${newQuests.length} quests for ${uid} (${excludeTemplateIds.size} templates excluded)`);
  return newQuests.map(q => q.id);
}

// GET /api/quests/pool?player=X — get or initialize the quest pool
router.get('/api/quests/pool', (req, res) => {
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  if (!playerParam) return res.status(400).json({ error: 'player parameter required' });
  const userRecord = state.users[playerParam];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(playerParam);
  const playerLevel = getLevelInfo(userRecord.xp || 0).level;

  // Auto-generate if player has no generated quests yet
  if (!pp.generatedQuests || pp.generatedQuests.length === 0) {
    pp.generatedQuests = generatePlayerQuests(playerParam, playerLevel);
  }

  // Build/rebuild visible pool if empty or stale
  if (!pp.activeQuestPool || pp.activeQuestPool.length === 0) {
    pp.activeQuestPool = buildVisiblePool(playerParam, playerLevel);
    savePlayerProgress();
  } else {
    // Remove completed/claimed quests from visible pool
    const validIds = new Set(state.quests.filter(q => q.status === 'open').map(q => q.id));
    pp.activeQuestPool = pp.activeQuestPool.filter(id => validIds.has(id));
    if (pp.activeQuestPool.length < 3) {
      pp.activeQuestPool = buildVisiblePool(playerParam, playerLevel);
      savePlayerProgress();
    }
  }

  const poolQuests = pp.activeQuestPool
    .map(id => state.questsById.get(id))
    .filter(Boolean);

  res.json({ pool: poolQuests, lastRefresh: pp.lastPoolRefresh || null });
});

// POST /api/quests/pool/refresh?player=X — full pool refresh (6h cooldown)
// Generates 18 NEW quests from templates (per player), replaces old open ones
router.post('/api/quests/pool/refresh', requireApiKey, (req, res) => {
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  if (!playerParam) return res.status(400).json({ error: 'player parameter required' });
  const userRecord = state.users[playerParam];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(playerParam);
  const playerLevel = getLevelInfo(userRecord.xp || 0).level;

  // Cooldown check: 6 hours
  const COOLDOWN_MS = 6 * 3600 * 1000;
  const nowMs = Date.now();
  if (pp.lastPoolRefresh) {
    const elapsed = nowMs - new Date(pp.lastPoolRefresh).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitH = Math.floor((COOLDOWN_MS - elapsed) / 3600000);
      const waitMin = Math.ceil(((COOLDOWN_MS - elapsed) % 3600000) / 60000);
      return res.status(429).json({ error: `Pool refresh cooldown. Try again in ${waitH}h ${waitMin}min.` });
    }
  }

  // Generate 18 new quests from templates (old open ones get removed)
  pp.generatedQuests = generatePlayerQuests(playerParam, playerLevel);
  pp.activeQuestPool = buildVisiblePool(playerParam, playerLevel);
  pp.lastPoolRefresh = new Date().toISOString();
  savePlayerProgress();

  const poolQuests = pp.activeQuestPool
    .map(id => state.questsById.get(id))
    .filter(Boolean);

  res.json({ ok: true, pool: poolQuests, generated: pp.generatedQuests.length, lastRefresh: pp.lastPoolRefresh });
});

// POST /api/quests/reset-recurring — reset completed recurring quests based on interval
// Also kept as GET for backward compatibility
router.post('/api/quests/reset-recurring', requireApiKey, (req, res) => {
  return resetRecurringHandler(req, res);
});
router.get('/api/quests/reset-recurring', requireApiKey, (req, res) => {
  return resetRecurringHandler(req, res);
});
function resetRecurringHandler(req, res) {
  const nowMs = Date.now();
  const INTERVAL_MS = { daily: 24*3600*1000, weekly: 7*24*3600*1000, monthly: 30*24*3600*1000 };
  let resetCount = 0;
  const resetPlayerQuestIds = new Set();
  for (const q of state.quests) {
    if (q.status !== 'completed' || !q.recurrence) continue;
    const interval = INTERVAL_MS[q.recurrence];
    if (!interval) continue;
    const lastDone = q.lastCompletedAt ? new Date(q.lastCompletedAt).getTime() : 0;
    if (nowMs - lastDone >= interval) {
      q.status = 'open';
      q.claimedBy = null;
      q.completedBy = null;
      q.completedAt = null;
      resetCount++;
      // Player-quest types track completion in pp.completedQuests keyed by
      // quest id. Without clearing it, the next claim returns HTTP 409 forever.
      if (PLAYER_QUEST_TYPES.includes(q.type || 'development')) {
        resetPlayerQuestIds.add(q.id);
      }
    }
  }
  let progressCleared = 0;
  if (resetPlayerQuestIds.size > 0) {
    for (const pp of Object.values(state.playerProgress || {})) {
      if (!pp?.completedQuests) continue;
      for (const qid of resetPlayerQuestIds) {
        if (pp.completedQuests[qid]) {
          delete pp.completedQuests[qid];
          progressCleared++;
        }
      }
    }
    if (progressCleared > 0) savePlayerProgress();
  }
  if (resetCount > 0) saveQuests();
  console.log(`[recurring] reset ${resetCount} quest(s), cleared ${progressCleared} per-player completion(s)`);
  res.json({ ok: true, reset: resetCount, progressCleared });
}

// GET /api/admin/keys
router.get('/api/admin/keys', requireMasterKey, (req, res) => {
  const master = getMasterKey();
  const allKeys = [
    { key: master, label: 'Master Key', created: null, isMaster: true },
    ...state.managedKeys.map(k => ({ ...k, isMaster: false })),
  ];
  res.json(allKeys.map(k => ({ ...k, masked: k.key.slice(0, 4) + '****' + k.key.slice(-4) })));
});

// POST /api/admin/keys
router.post('/api/admin/keys', requireMasterKey, (req, res) => {
  const { label } = req.body;
  const newKey = crypto.randomBytes(16).toString('hex');
  const entry = { key: newKey, label: label || `Key ${state.managedKeys.length + 1}`, created: now() };
  state.managedKeys.push(entry);
  state.validApiKeys.add(newKey);
  saveManagedKeys();
  console.log(`[admin] new key created: ${entry.label}`);
  res.json({ ok: true, key: newKey, masked: newKey.slice(0, 4) + '****' + newKey.slice(-4), label: entry.label });
});

// DELETE /api/admin/keys/:key
router.delete('/api/admin/keys/:key', requireMasterKey, (req, res) => {
  const keyParam = req.params.key;
  if (keyParam === getMasterKey()) {
    return res.status(400).json({ error: 'Cannot revoke master key' });
  }
  const before = state.managedKeys.length;
  state.managedKeys = state.managedKeys.filter(k => k.key !== keyParam);
  if (state.managedKeys.length < before) {
    state.validApiKeys.delete(keyParam);
    saveManagedKeys();
    console.log(`[admin] key revoked`);
    return res.json({ ok: true });
  }
  res.status(404).json({ error: 'Key not found' });
});

module.exports = router;
