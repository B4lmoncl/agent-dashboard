/**
 * Weekly Challenge Routes — "Sternenpfad"
 * 3-stage weekly challenge with star ratings (1-3 per stage, max 9),
 * weekly modifiers, and speed bonus mechanics.
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, awardCurrency, getLegendaryModifiers } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

// ─── Load weekly challenge data ─────────────────────────────────────────────
let WEEKLY_DATA = { weeklyChallenge: { templates: [], stageRewards: {}, resetDay: 'monday', weeklyModifiers: [], speedBonusDays: 2 } };

function loadWeeklyChallenges() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'weeklyChallenges.json');
  try {
    if (fs.existsSync(filePath)) {
      WEEKLY_DATA = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      state.weeklyChallengeData = WEEKLY_DATA.weeklyChallenge;
      console.log(`[weekly] Loaded ${WEEKLY_DATA.weeklyChallenge.templates.length} challenge templates, ${(WEEKLY_DATA.weeklyChallenge.weeklyModifiers || []).length} modifiers`);
    }
  } catch (e) {
    console.warn('[weekly] Failed to load:', e.message);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWeekId() {
  // ISO week: YYYY-WNN
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekNumber(weekId) {
  return parseInt(weekId.replace(/\D/g, ''), 10);
}

function getActiveModifier(weekId) {
  const modifiers = WEEKLY_DATA.weeklyChallenge?.weeklyModifiers || [];
  if (modifiers.length === 0) return null;
  const weekSeed = getWeekNumber(weekId);
  return modifiers[weekSeed % modifiers.length];
}

function getActiveChallenge(userId) {
  const u = state.users[userId];
  if (!u) return null;
  const weekId = getWeekId();
  u.weeklyChallenge = u.weeklyChallenge || {};

  // If no challenge this week or stale, pick a new one
  if (u.weeklyChallenge.weekId !== weekId) {
    const templates = WEEKLY_DATA.weeklyChallenge?.templates || [];
    if (templates.length === 0) return null;
    // Pick deterministically based on week for consistency across users
    const weekSeed = getWeekNumber(weekId);
    const template = templates[weekSeed % templates.length];
    u.weeklyChallenge = {
      weekId,
      templateId: template.id,
      currentStage: 0,
      progress: {},
      completedStages: [],
      stars: [0, 0, 0],
      stageStartedAt: [now(), null, null],
      startedAt: now(),
    };
    saveUsers();
  }

  // Backfill stars/stageStartedAt for existing users
  if (!u.weeklyChallenge.stars) u.weeklyChallenge.stars = [0, 0, 0];
  if (!u.weeklyChallenge.stageStartedAt) u.weeklyChallenge.stageStartedAt = [u.weeklyChallenge.startedAt || now(), null, null];

  const template = (WEEKLY_DATA.weeklyChallenge?.templates || []).find(t => t.id === u.weeklyChallenge.templateId);
  return { ...u.weeklyChallenge, template };
}

// Calculate stars for a given stage based on progress
function calculateStageStars(stageData, progress, u, stageStartedAt, modifier) {
  if (!stageData || !stageData.starThresholds) return 0;
  const thresholds = stageData.starThresholds; // [1star, 2star, 3star]
  const req = stageData.requirement;

  // Use modifier-adjusted progress for star calculation
  const effectiveProgress = modifier ? getEffectiveProgress(progress, modifier) : progress;

  // Get the relevant progress value
  let value = 0;
  switch (req.type) {
    case 'quest_type':
      value = effectiveProgress[`type_${req.questType}`] || 0;
      break;
    case 'total_quests':
      value = effectiveProgress.totalQuests || 0;
      break;
    case 'unique_types':
      value = Object.keys(effectiveProgress.types || {}).length;
      break;
    case 'streak_maintained':
      value = u.streakDays || 0;
      break;
  }

  // Legendary: challenge_score_bonus — effective value boost for star thresholds
  const csb = getLegendaryModifiers(u.id).challengeScoreBonus || 0;
  if (csb > 0) value = Math.round(value * (1 + csb));

  // Count overachievement stars (0, 1, or 2)
  let stars = 0;
  if (value >= thresholds[0]) stars = 1;
  if (value >= thresholds[1]) stars = 2;

  // Speed bonus: +1 star if completed within speedBonusDays
  const speedBonusDays = WEEKLY_DATA.weeklyChallenge?.speedBonusDays || 2;
  if (stars >= 1 && stageStartedAt) {
    const elapsed = (Date.now() - new Date(stageStartedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed <= speedBonusDays) {
      stars = Math.min(3, stars + 1);
    }
  }

  // Hard cap: 3 stars if overachievement threshold 3 is met (regardless of speed)
  if (value >= thresholds[2]) stars = 3;

  return stars;
}

function evaluateStageProgress(userId, challenge) {
  if (!challenge || !challenge.template) return false;
  const u = state.users[userId];
  if (!u) return false;

  const nextStage = challenge.currentStage + 1;
  if (nextStage > (challenge.template.stages?.length || 0)) return false;

  const stageData = challenge.template.stages[challenge.currentStage];
  if (!stageData) return false;

  // Use modifier-adjusted progress for evaluation
  const modifier = getActiveModifier(challenge.weekId);
  const rawProgress = challenge.progress || {};
  const progress = modifier ? getEffectiveProgress(rawProgress, modifier) : rawProgress;
  const req = stageData.requirement;

  switch (req.type) {
    case 'quest_type':
      return (progress[`type_${req.questType}`] || 0) >= req.count;
    case 'total_quests':
      return (progress.totalQuests || 0) >= req.count;
    case 'unique_types':
      return Object.keys(progress.types || {}).length >= req.count;
    case 'streak_maintained':
      return (u.streakDays || 0) >= req.count;
    default:
      return false;
  }
}

// Get effective progress values (modifier-adjusted) for a given progress object
function getEffectiveProgress(progress, modifier) {
  if (!modifier || !progress.effective) return progress;
  // Return a merged view: raw counts for compatibility, effective counts for evaluation
  return {
    ...progress,
    totalQuests: progress.effective.totalQuests || progress.totalQuests || 0,
    // Override type counts with effective values
    ...Object.fromEntries(
      Object.entries(progress.effective)
        .filter(([k]) => k.startsWith('type_'))
        .map(([k, v]) => [k, v])
    ),
  };
}

// ─── GET /api/weekly-challenge — get current weekly challenge + progress ─────
router.get('/api/weekly-challenge', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  if (!u) return res.json({ challenge: null });

  const challenge = getActiveChallenge(u.id);
  if (!challenge || !challenge.template) return res.json({ challenge: null });

  const stageRewards = WEEKLY_DATA.weeklyChallenge?.stageRewards || {};
  const modifier = getActiveModifier(challenge.weekId);

  // Check if current stage can be claimed
  const canAdvance = evaluateStageProgress(u.id, challenge);

  // Calculate current stars per stage
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

  res.json({
    challenge: {
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
    },
  });
});

// POST /api/weekly-challenge/progress — record quest completion for weekly challenge
router.post('/api/weekly-challenge/progress', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { questType } = req.body;
  const challenge = getActiveChallenge(uid);
  if (!challenge || !challenge.template) return res.json({ updated: false });

  const modifier = getActiveModifier(challenge.weekId);

  // Track progress
  u.weeklyChallenge.progress = u.weeklyChallenge.progress || {};
  const p = u.weeklyChallenge.progress;
  p.totalQuests = (p.totalQuests || 0) + 1;
  if (questType) {
    p[`type_${questType}`] = (p[`type_${questType}`] || 0) + 1;
    p.types = p.types || {};
    p.types[questType] = (p.types[questType] || 0) + 1;
  }

  // Apply modifier to effective progress (stored separately for star calculation)
  if (modifier && questType) {
    p.effective = p.effective || {};
    if (modifier.bonusType === 'variety') {
      // First occurrence of each type gets bonus multiplier, repeated uses get malus
      const typeCount = p.types[questType] || 0;
      const increment = typeCount === 1 ? modifier.bonusMultiplier : modifier.malusMultiplier;
      p.effective.totalQuests = (p.effective.totalQuests || 0) + increment;
      p.effective[`type_${questType}`] = (p.effective[`type_${questType}`] || 0) + increment;
    } else {
      const multiplier = questType === modifier.bonusType ? modifier.bonusMultiplier : modifier.malusMultiplier;
      p.effective.totalQuests = (p.effective.totalQuests || 0) + multiplier;
      p.effective[`type_${questType}`] = (p.effective[`type_${questType}`] || 0) + multiplier;
    }
  }

  saveUsers();
  res.json({ updated: true, progress: p });
});

// POST /api/weekly-challenge/claim — claim stage reward
router.post('/api/weekly-challenge/claim', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const challenge = getActiveChallenge(uid);
  if (!challenge || !challenge.template) return res.status(400).json({ error: 'No active challenge' });

  const nextStage = challenge.currentStage + 1;
  if (nextStage > (challenge.template.stages?.length || 0)) {
    return res.status(400).json({ error: 'All stages already completed' });
  }
  // Prevent double-claim (idempotency)
  if (challenge.completedStages.includes(nextStage)) {
    return res.status(409).json({ error: 'Stage already claimed' });
  }

  const canAdvance = evaluateStageProgress(uid, challenge);
  if (!canAdvance) {
    return res.status(400).json({ error: 'Stage requirements not yet met' });
  }

  // Calculate stars for this stage before claiming
  const stageData = challenge.template.stages[challenge.currentStage];
  const modifier = getActiveModifier(challenge.weekId);
  const stageStars = calculateStageStars(stageData, challenge.progress, u, u.weeklyChallenge.stageStartedAt[challenge.currentStage], modifier);
  u.weeklyChallenge.stars[challenge.currentStage] = stageStars;

  // Award rewards (base + star bonus)
  const stageRewards = WEEKLY_DATA.weeklyChallenge?.stageRewards || {};
  const rewards = { ...(stageRewards[String(nextStage)] || {}) };

  // Star bonus: up to 33% extra per stage (1★=0%, 2★=15%, 3★=33%)
  const starBonusPct = stageStars === 3 ? 0.33 : stageStars === 2 ? 0.15 : 0;
  if (starBonusPct > 0) {
    for (const key of Object.keys(rewards)) {
      if (key !== 'xp') { // XP calculated separately for level-up
        rewards[key] = Math.floor(rewards[key] * (1 + starBonusPct));
      }
    }
    if (rewards.xp) rewards.xp = Math.floor(rewards.xp * (1 + starBonusPct));
  }

  ensureUserCurrencies(u);
  if (rewards.gold) awardCurrency(uid, 'gold', rewards.gold);
  if (rewards.runensplitter) awardCurrency(uid, 'runensplitter', rewards.runensplitter);
  if (rewards.essenz) awardCurrency(uid, 'essenz', rewards.essenz);
  if (rewards.sternentaler) awardCurrency(uid, 'sternentaler', rewards.sternentaler);
  const prevLevel = rewards.xp ? getLevelInfo(u.xp || 0).level : 0;
  if (rewards.xp) { u.xp = (u.xp || 0) + rewards.xp; }
  // Award stardust on level-up (same logic as quest completion)
  if (rewards.xp) {
    const newLevel = getLevelInfo(u.xp).level;
    if (newLevel > prevLevel) awardCurrency(uid, 'stardust', 5 + newLevel);
  }

  // Battle Pass XP — award per star earned
  try { const { grantBattlePassXP } = require('./battlepass'); for (let s = 0; s < stageStars; s++) grantBattlePassXP(u, 'sternenpfad_star'); } catch {}

  // Advance stage
  u.weeklyChallenge.completedStages.push(nextStage);
  u.weeklyChallenge.currentStage = nextStage;

  // Set stageStartedAt for next stage
  if (nextStage < 3) {
    u.weeklyChallenge.stageStartedAt[nextStage] = now();
  }

  saveUsers();
  res.json({
    message: `Stufe ${nextStage} abgeschlossen! (${stageStars}★)`,
    stage: nextStage,
    stars: stageStars,
    rewards,
    challenge: {
      currentStage: u.weeklyChallenge.currentStage,
      completedStages: u.weeklyChallenge.completedStages,
      stars: u.weeklyChallenge.stars,
    },
  });
});

// ─── Cumulative Star Milestones ──────────────────────────────────────────────

const STAR_MILESTONES = [
  { stars: 3, rewards: { gold: 50 } },
  { stars: 6, rewards: { gold: 100, essenz: 3 } },
  { stars: 9, rewards: { gold: 150, essenz: 5, sternentaler: 1 } },
];

// POST /api/weekly-challenge/claim-milestone — claim cumulative star milestone
router.post('/api/weekly-challenge/claim-milestone', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const challenge = getActiveChallenge(uid);
  if (!challenge) return res.status(400).json({ error: 'No active challenge' });

  const { stars: targetStars } = req.body;
  const milestone = STAR_MILESTONES.find(m => m.stars === targetStars);
  if (!milestone) return res.status(400).json({ error: 'Invalid milestone' });

  // Calculate total stars earned
  const totalStars = (u.weeklyChallenge.stars || []).reduce((s, v) => s + (v || 0), 0);
  if (totalStars < milestone.stars) {
    return res.status(400).json({ error: `Need ${milestone.stars} stars (have ${totalStars})` });
  }

  // Prevent double-claim
  u.weeklyChallenge.claimedMilestones = u.weeklyChallenge.claimedMilestones || [];
  if (u.weeklyChallenge.claimedMilestones.includes(milestone.stars)) {
    return res.status(409).json({ error: 'Milestone already claimed' });
  }

  // Award rewards
  ensureUserCurrencies(u);
  const rewards = { ...milestone.rewards };
  if (rewards.gold) awardCurrency(uid, 'gold', rewards.gold);
  if (rewards.essenz) awardCurrency(uid, 'essenz', rewards.essenz);
  if (rewards.sternentaler) awardCurrency(uid, 'sternentaler', rewards.sternentaler);

  u.weeklyChallenge.claimedMilestones.push(milestone.stars);

  saveUsers();
  console.log(`[weekly] ${uid} claimed ${milestone.stars}★ milestone`);
  res.json({ ok: true, stars: milestone.stars, rewards, claimedMilestones: u.weeklyChallenge.claimedMilestones });
});

module.exports = router;
module.exports.loadWeeklyChallenges = loadWeeklyChallenges;
module.exports.getWeekId = getWeekId;
module.exports.getActiveModifier = getActiveModifier;
