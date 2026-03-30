const express = require("express");
const router = express.Router();
const { state, saveUsers, ensureUserCurrencies } = require("../lib/state");
const { requireAuth } = require("../lib/middleware");
const { getLegendaryModifiers, createPlayerLock, getTodayBerlin } = require("../lib/helpers");
const factionClaimLock = createPlayerLock('faction-claim');
const factionDailyLock = createPlayerLock('faction-daily');
const factionsData = require("../public/data/factions.json");

// ─── Faction Daily Quests ─────────────────────────────────────────────────────
const FACTION_DAILY_TEMPLATES = {
  glut: [
    { id: "glut_d1", name: "Morgenfeuer", desc: "Complete 1 Fitness quest", req: { type: "quest_type_today", questType: "fitness", count: 1 }, repReward: 40, goldReward: 20 },
    { id: "glut_d2", name: "Ausdauerprobe", desc: "Complete 3 quests today", req: { type: "quests_today", count: 3 }, repReward: 25, goldReward: 15 },
    { id: "glut_d3", name: "Flamme halten", desc: "Complete at least 1 quest (maintain streak)", req: { type: "quests_today", count: 1 }, repReward: 15, goldReward: 10 },
  ],
  tinte: [
    { id: "tinte_d1", name: "Wissensdurst", desc: "Complete 1 Learning quest", req: { type: "quest_type_today", questType: "learning", count: 1 }, repReward: 40, goldReward: 20 },
    { id: "tinte_d2", name: "Tiefenrecherche", desc: "Complete 2 quests today", req: { type: "quests_today", count: 2 }, repReward: 25, goldReward: 15 },
    { id: "tinte_d3", name: "Stille Lektüre", desc: "Complete 1 quest today", req: { type: "quests_today", count: 1 }, repReward: 15, goldReward: 10 },
  ],
  amboss: [
    { id: "amboss_d1", name: "Tageswerk", desc: "Complete 1 Development or Personal quest", req: { type: "quest_type_today", questType: "development", count: 1 }, repReward: 40, goldReward: 20 },
    { id: "amboss_d2", name: "Schaffenskraft", desc: "Complete 3 quests today", req: { type: "quests_today", count: 3 }, repReward: 25, goldReward: 15 },
    { id: "amboss_d3", name: "Erster Hammerschlag", desc: "Complete 1 quest today", req: { type: "quests_today", count: 1 }, repReward: 15, goldReward: 10 },
  ],
  echo: [
    { id: "echo_d1", name: "Gemeinschaftsband", desc: "Complete 1 Social quest", req: { type: "quest_type_today", questType: "social", count: 1 }, repReward: 40, goldReward: 20 },
    { id: "echo_d2", name: "Verbindungen", desc: "Complete 2 quests today", req: { type: "quests_today", count: 2 }, repReward: 25, goldReward: 15 },
    { id: "echo_d3", name: "Erstes Wort", desc: "Complete 1 quest today", req: { type: "quests_today", count: 1 }, repReward: 15, goldReward: 10 },
  ],
};

function ensureFactionDailies(user) {
  const today = getTodayBerlin();
  if (!user.factionDailies || user.factionDailies.date !== today) {
    user.factionDailies = { date: today, quests: {} };
    for (const [fid, templates] of Object.entries(FACTION_DAILY_TEMPLATES)) {
      for (const t of templates) {
        user.factionDailies.quests[t.id] = { progress: 0, completed: false, claimed: false };
      }
    }
  }
  return user.factionDailies;
}

/**
 * Progress faction dailies based on completed quest.
 * Called from onQuestCompletedByUser in helpers.js.
 */
function progressFactionDailies(userId, quest) {
  const u = state.users[userId];
  if (!u) return;
  const dailies = ensureFactionDailies(u);
  const today = getTodayBerlin();

  // Count today's completions
  const pp = state.playerProgress?.[userId] || {};
  const todayCompletions = Object.values(pp.completedQuests || {}).filter(cq => cq && cq.at && cq.at.startsWith(today)).length;
  const questType = quest?.type || '';

  for (const [fid, templates] of Object.entries(FACTION_DAILY_TEMPLATES)) {
    for (const t of templates) {
      const dq = dailies.quests[t.id];
      if (!dq || dq.completed) continue;
      let progress = 0;
      if (t.req.type === 'quests_today') {
        progress = todayCompletions;
      } else if (t.req.type === 'quest_type_today') {
        if (questType === t.req.questType || (t.req.questType === 'development' && questType === 'personal')) {
          const typeCompletions = Object.values(pp.completedQuests || {}).filter(cq =>
            cq && cq.at && cq.at.startsWith(today) && (cq.type === t.req.questType || (t.req.questType === 'development' && cq.type === 'personal'))
          ).length;
          progress = typeCompletions;
        }
      }
      dq.progress = Math.min(progress, t.req.count);
      if (dq.progress >= t.req.count) dq.completed = true;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStanding(rep) {
  const standings = factionsData.standings;
  let current = standings[0];
  for (const s of standings) {
    if (rep >= s.minRep) current = s;
  }
  return current;
}

function getNextStanding(rep) {
  const standings = factionsData.standings;
  for (const s of standings) {
    if (rep < s.minRep) return s;
  }
  return null; // max standing reached
}

// Migrate old German standing IDs to English
const STANDING_MIGRATION = {
  freundlich: "friendly", respektiert: "honored", geehrt: "revered",
  verehrt: "exalted", erhaben: "paragon",
};

// Get current ISO week number (used for weekly bonus auto-reset)
function getCurrentWeekId() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / 86400000);
  return `${now.getFullYear()}-W${String(Math.ceil((days + startOfYear.getDay() + 1) / 7)).padStart(2, '0')}`;
}

function ensureUserFactions(user) {
  if (!user.factions) {
    user.factions = {};
    for (const f of factionsData.factions) {
      user.factions[f.id] = { rep: 0, weeklyBonusUsed: 0, claimedRewards: [] };
    }
  }
  // Ensure all factions exist (for new factions added later)
  for (const f of factionsData.factions) {
    if (!user.factions[f.id]) {
      user.factions[f.id] = { rep: 0, weeklyBonusUsed: 0, claimedRewards: [] };
    }
    // Migrate old German standing IDs in claimedRewards
    const pd = user.factions[f.id];
    if (pd.claimedRewards) {
      pd.claimedRewards = pd.claimedRewards.map(id => STANDING_MIGRATION[id] || id);
    }
  }
  // Auto-reset weekly bonus when a new week starts
  const currentWeek = getCurrentWeekId();
  if (user._factionWeekId !== currentWeek) {
    user._factionWeekId = currentWeek;
    for (const fid of Object.keys(user.factions)) {
      user.factions[fid].weeklyBonusUsed = 0;
    }
  }
}

// ─── GET /api/factions — Faction definitions + player standings ──────────────

router.get("/", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserFactions(user);

  const factions = factionsData.factions.map(f => {
    const playerData = user.factions[f.id];
    const standing = getStanding(playerData.rep);
    const next = getNextStanding(playerData.rep);
    const progress = next
      ? (playerData.rep - standing.minRep) / (next.minRep - standing.minRep)
      : 1;

    return {
      ...f,
      playerRep: playerData.rep,
      standing: standing.id,
      standingName: standing.name,
      standingColor: standing.color,
      nextStanding: next ? { name: next.name, minRep: next.minRep, color: next.color } : null,
      progress,
      weeklyBonusUsed: playerData.weeklyBonusUsed,
      weeklyBonusMax: 3,
      claimedRewards: playerData.claimedRewards || [],
    };
  });

  res.json({
    factions,
    standings: factionsData.standings,
    repPerQuest: factionsData.repPerQuest,
    weeklyBonusMultiplier: factionsData.weeklyBonusMultiplier,
    dailyQuests: (() => {
      const dailies = ensureFactionDailies(user);
      const result = {};
      for (const [fid, templates] of Object.entries(FACTION_DAILY_TEMPLATES)) {
        result[fid] = templates.map(t => ({
          ...t,
          ...(dailies.quests[t.id] || { progress: 0, completed: false, claimed: false }),
        }));
      }
      return result;
    })(),
  });
});

// ─── POST /api/factions/:factionId/claim-daily — Claim daily quest reward ────
router.post("/:factionId/claim-daily/:dailyId", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!factionDailyLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  const { factionId, dailyId } = req.params;
  const dailies = ensureFactionDailies(user);
  const dq = dailies.quests[dailyId];
  if (!dq) return res.status(404).json({ error: "Daily quest not found" });
  if (!dq.completed) return res.status(400).json({ error: "Quest not yet completed" });
  if (dq.claimed) return res.status(400).json({ error: "Already claimed" });

  // Find template
  const templates = FACTION_DAILY_TEMPLATES[factionId];
  if (!templates) return res.status(404).json({ error: "Faction not found" });
  const template = templates.find(t => t.id === dailyId);
  if (!template) return res.status(404).json({ error: "Daily template not found" });

  // Award rep + gold
  ensureUserFactions(user);
  user.factions[factionId].rep = (user.factions[factionId].rep || 0) + template.repReward;
  user._factionDailiesComplete = (user._factionDailiesComplete || 0) + 1;
  ensureUserCurrencies(user);
  user.currencies.gold = (user.currencies.gold || 0) + template.goldReward;
  if (user.gold !== undefined) user.gold = user.currencies.gold;

  dq.claimed = true;
  saveUsers();

  res.json({
    ok: true,
    repGained: template.repReward,
    goldGained: template.goldReward,
    newRep: user.factions[factionId].rep,
  });
  } finally { factionDailyLock.release(uid); }
});

// ─── POST /api/factions/:factionId/claim — Claim standing reward ─────────────

router.post("/:factionId/claim", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!factionClaimLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserFactions(user);

  const factionId = req.params.factionId;
  const faction = factionsData.factions.find(f => f.id === factionId);
  if (!faction) return res.status(404).json({ error: "Faction not found" });

  const playerData = user.factions[factionId];
  const standing = getStanding(playerData.rep);

  // Find the reward for current standing
  const reward = faction.rewards[standing.id];
  if (!reward) return res.status(400).json({ error: "No reward available at current standing" });

  // Check if already claimed
  if (playerData.claimedRewards.includes(standing.id)) {
    return res.status(400).json({ error: "Reward already claimed" });
  }

  // Grant rewards
  const granted = [];

  if (reward.title) {
    // Add title to user's earned titles
    if (!user.earnedTitles) user.earnedTitles = [];
    if (!user.earnedTitles.some(t => t.id === `faction_${factionId}_${standing.id}`)) {
      user.earnedTitles.push({
        id: `faction_${factionId}_${standing.id}`,
        name: reward.title,
        rarity: reward.titleRarity || "uncommon",
        source: `${faction.name} — ${standing.name}`,
        earnedAt: new Date().toISOString(),
      });
      granted.push({ type: "title", name: reward.title, rarity: reward.titleRarity });
    }
  }

  if (reward.shopDiscount) {
    if (!user.factionBonuses) user.factionBonuses = {};
    user.factionBonuses[`${factionId}_discount`] = reward.shopDiscount;
    granted.push({ type: "discount", amount: reward.shopDiscount });
  }

  if (reward.frame) {
    // Cosmetic frame
    if (!user.unlockedFrames) user.unlockedFrames = [];
    if (!user.unlockedFrames.some(f => f.id === reward.frame)) {
      const frameColor = faction.accent;
      user.unlockedFrames.push({
        id: reward.frame,
        name: reward.frameDesc || `${faction.name} Frame`,
        color: frameColor,
        glow: true,
        source: `${faction.name} — ${standing.name}`,
      });
      granted.push({ type: "frame", name: reward.frameDesc, color: frameColor });
    }
  }

  if (reward.legendaryEffect) {
    if (!user.legendaryEffects) user.legendaryEffects = [];
    if (!user.legendaryEffects.includes(reward.legendaryEffect)) {
      user.legendaryEffects.push(reward.legendaryEffect);
      granted.push({ type: "legendaryEffect", id: reward.legendaryEffect, desc: reward.effectDesc });
    }
  }

  if (reward.recipe) {
    if (!user.unlockedRecipes) user.unlockedRecipes = [];
    if (!user.unlockedRecipes.includes(reward.recipe)) {
      user.unlockedRecipes.push(reward.recipe);
      granted.push({ type: "recipe", id: reward.recipe, desc: reward.recipeDesc });
    }
  }

  playerData.claimedRewards.push(standing.id);
  saveUsers();

  res.json({ ok: true, granted, standing: standing.id, factionId });
  } finally { factionClaimLock.release(uid); }
});

// ─── Helper: Grant reputation (called from quest completion) ─────────────────

function grantReputation(user, questType, questRarity) {
  ensureUserFactions(user);

  const repAmount = factionsData.repPerQuest[questRarity] || factionsData.repPerQuest.common;
  const results = [];

  for (const faction of factionsData.factions) {
    if (!faction.questTypes.includes(questType)) continue;

    const playerData = user.factions[faction.id];
    const oldStanding = getStanding(playerData.rep);

    // Check weekly bonus
    let multiplier = 1;
    if (playerData.weeklyBonusUsed < 3) {
      multiplier = factionsData.weeklyBonusMultiplier;
      playerData.weeklyBonusUsed++;
    }

    const legendaryRepBoost = 1 + (getLegendaryModifiers(user.id).factionRepBoost || 0);
    const gained = Math.round(repAmount * multiplier * legendaryRepBoost);
    playerData.rep += gained;

    const newStanding = getStanding(playerData.rep);
    const leveledUp = oldStanding.id !== newStanding.id;

    results.push({
      factionId: faction.id,
      factionName: faction.name,
      factionIcon: faction.icon,
      gained,
      totalRep: playerData.rep,
      standing: newStanding.id,
      standingName: newStanding.name,
      leveledUp,
      bonusUsed: multiplier > 1,
    });
  }

  return results;
}

module.exports = router;
module.exports.grantReputation = grantReputation;
module.exports.ensureUserFactions = ensureUserFactions;
module.exports.progressFactionDailies = progressFactionDailies;
