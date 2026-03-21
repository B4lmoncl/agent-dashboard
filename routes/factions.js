const express = require("express");
const router = express.Router();
const { state, saveData } = require("../lib/state");
const { requireAuth } = require("../lib/middleware");
const factionsData = require("../public/data/factions.json");

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
}

// ─── GET /api/factions — Faction definitions + player standings ──────────────

router.get("/", requireAuth, (req, res) => {
  const user = state.usersByName.get(req.playerName);
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
  });
});

// ─── POST /api/factions/:factionId/claim — Claim standing reward ─────────────

router.post("/:factionId/claim", requireAuth, (req, res) => {
  const user = state.usersByName.get(req.playerName);
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

  playerData.claimedRewards.push(standing.id);
  saveData();

  res.json({ ok: true, granted, standing: standing.id, factionId });
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

    const gained = Math.round(repAmount * multiplier);
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

// ─── Weekly reset (called from server.js midnight cron) ──────────────────────

function resetWeeklyBonuses() {
  for (const [, user] of state.usersByName) {
    if (!user.factions) continue;
    for (const fid of Object.keys(user.factions)) {
      user.factions[fid].weeklyBonusUsed = 0;
    }
  }
  saveData();
}

module.exports = router;
module.exports.grantReputation = grantReputation;
module.exports.resetWeeklyBonuses = resetWeeklyBonuses;
module.exports.ensureUserFactions = ensureUserFactions;
