/**
 * Weekly Challenge Routes — "Wöchentliche Herausforderung"
 * 3-stage weekly challenge mode with special rules and exclusive rewards.
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, awardCurrency } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

// ─── Load weekly challenge data ─────────────────────────────────────────────
let WEEKLY_DATA = { weeklyChallenge: { templates: [], stageRewards: {}, resetDay: 'monday' } };

function loadWeeklyChallenges() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'weeklyChallenges.json');
  try {
    if (fs.existsSync(filePath)) {
      WEEKLY_DATA = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      state.weeklyChallengeData = WEEKLY_DATA.weeklyChallenge;
      console.log(`[weekly] Loaded ${WEEKLY_DATA.weeklyChallenge.templates.length} challenge templates`);
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
    const weekSeed = parseInt(weekId.replace(/\D/g, ''), 10);
    const template = templates[weekSeed % templates.length];
    u.weeklyChallenge = {
      weekId,
      templateId: template.id,
      currentStage: 0,
      progress: {},
      completedStages: [],
      startedAt: now(),
    };
    saveUsers();
  }

  const template = (WEEKLY_DATA.weeklyChallenge?.templates || []).find(t => t.id === u.weeklyChallenge.templateId);
  return { ...u.weeklyChallenge, template };
}

function evaluateStageProgress(userId, challenge) {
  if (!challenge || !challenge.template) return 0;
  const u = state.users[userId];
  if (!u) return 0;

  const nextStage = challenge.currentStage + 1;
  if (nextStage > (challenge.template.stages?.length || 0)) return challenge.currentStage;

  const stageData = challenge.template.stages[challenge.currentStage];
  if (!stageData) return challenge.currentStage;

  const progress = challenge.progress || {};
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

// ─── GET /api/weekly-challenge — get current weekly challenge + progress ─────
router.get('/api/weekly-challenge', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  if (!u) return res.json({ challenge: null });

  const challenge = getActiveChallenge(u.id);
  if (!challenge || !challenge.template) return res.json({ challenge: null });

  const stageRewards = WEEKLY_DATA.weeklyChallenge?.stageRewards || {};

  // Check if current stage can be auto-completed
  const canAdvance = evaluateStageProgress(u.id, challenge);

  res.json({
    challenge: {
      weekId: challenge.weekId,
      templateId: challenge.templateId,
      name: challenge.template.name,
      icon: challenge.template.icon,
      stages: challenge.template.stages.map((s, i) => ({
        ...s,
        completed: challenge.completedStages.includes(i + 1),
        current: i === challenge.currentStage,
        rewards: stageRewards[String(i + 1)] || {},
      })),
      currentStage: challenge.currentStage,
      progress: challenge.progress,
      canAdvance,
      startedAt: challenge.startedAt,
    },
  });
});

// POST /api/weekly-challenge/progress — record quest completion for weekly challenge
router.post('/api/weekly-challenge/progress', requireAuth, (req, res) => {
  const uid = req.resolvedPlayerId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { questType } = req.body;
  const challenge = getActiveChallenge(uid);
  if (!challenge || !challenge.template) return res.json({ updated: false });

  // Track progress
  u.weeklyChallenge.progress = u.weeklyChallenge.progress || {};
  const p = u.weeklyChallenge.progress;
  p.totalQuests = (p.totalQuests || 0) + 1;
  if (questType) {
    p[`type_${questType}`] = (p[`type_${questType}`] || 0) + 1;
    p.types = p.types || {};
    p.types[questType] = (p.types[questType] || 0) + 1;
  }

  saveUsers();
  res.json({ updated: true, progress: p });
});

// POST /api/weekly-challenge/claim — claim stage reward
router.post('/api/weekly-challenge/claim', requireAuth, (req, res) => {
  const uid = req.resolvedPlayerId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const challenge = getActiveChallenge(uid);
  if (!challenge || !challenge.template) return res.status(400).json({ error: 'No active challenge' });

  const nextStage = challenge.currentStage + 1;
  if (nextStage > (challenge.template.stages?.length || 0)) {
    return res.status(400).json({ error: 'Alle Stufen bereits abgeschlossen' });
  }

  const canAdvance = evaluateStageProgress(uid, challenge);
  if (!canAdvance) {
    return res.status(400).json({ error: 'Stufe noch nicht erfüllt' });
  }

  // Award rewards
  const stageRewards = WEEKLY_DATA.weeklyChallenge?.stageRewards || {};
  const rewards = stageRewards[String(nextStage)] || {};

  ensureUserCurrencies(u);
  if (rewards.gold) { u.currencies.gold = (u.currencies.gold || 0) + rewards.gold; u.gold = u.currencies.gold; }
  if (rewards.runensplitter) awardCurrency(uid, 'runensplitter', rewards.runensplitter);
  if (rewards.essenz) awardCurrency(uid, 'essenz', rewards.essenz);
  if (rewards.sternentaler) awardCurrency(uid, 'sternentaler', rewards.sternentaler);
  if (rewards.xp) { u.xp = (u.xp || 0) + rewards.xp; }

  // Advance stage
  u.weeklyChallenge.completedStages.push(nextStage);
  u.weeklyChallenge.currentStage = nextStage;

  saveUsers();
  res.json({
    message: `Stufe ${nextStage} abgeschlossen!`,
    stage: nextStage,
    rewards,
    challenge: {
      currentStage: u.weeklyChallenge.currentStage,
      completedStages: u.weeklyChallenge.completedStages,
    },
  });
});

module.exports = router;
module.exports.loadWeeklyChallenges = loadWeeklyChallenges;
