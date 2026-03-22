const express = require("express");
const router = express.Router();
const { state, saveData, saveUsers } = require("../lib/state");
const { requireAuth } = require("../lib/middleware");
const bpData = require("../public/data/battlePass.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureUserBP(user) {
  if (!user.battlePass) {
    user.battlePass = {
      season: bpData.config.currentSeason,
      xp: 0,
      level: 0,
      claimedLevels: [],
    };
  }
  // Reset if new season
  if (user.battlePass.season !== bpData.config.currentSeason) {
    user.battlePass = {
      season: bpData.config.currentSeason,
      xp: 0,
      level: 0,
      claimedLevels: [],
    };
  }
}

function getBPLevel(xp) {
  return Math.min(Math.floor(xp / bpData.config.xpPerLevel), bpData.config.levels);
}

// ─── GET /api/battlepass — Current pass state for player ─────────────────────

router.get("/", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserBP(user);

  const bp = user.battlePass;
  const level = getBPLevel(bp.xp);
  const xpInLevel = bp.xp % bpData.config.xpPerLevel;
  const progress = xpInLevel / bpData.config.xpPerLevel;

  // Calculate season end
  const seasonStart = bp.seasonStartedAt || new Date().toISOString();
  const seasonEnd = new Date(new Date(seasonStart).getTime() + bpData.config.seasonDurationDays * 86400000).toISOString();

  res.json({
    config: bpData.config,
    rewards: bpData.rewards,
    xpSources: bpData.xpSources,
    player: {
      xp: bp.xp,
      level,
      xpInLevel,
      xpPerLevel: bpData.config.xpPerLevel,
      progress,
      claimedLevels: bp.claimedLevels,
      seasonEnd,
    },
  });
});

// ─── POST /api/battlepass/claim/:level — Claim reward for a level ────────────

router.post("/claim/:level", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserBP(user);

  const targetLevel = parseInt(req.params.level, 10);
  if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > bpData.config.levels) {
    return res.status(400).json({ error: "Invalid level" });
  }

  const bp = user.battlePass;
  const currentLevel = getBPLevel(bp.xp);

  if (targetLevel > currentLevel) {
    return res.status(400).json({ error: "Level not yet reached" });
  }

  if (bp.claimedLevels.includes(targetLevel)) {
    return res.status(400).json({ error: "Already claimed" });
  }

  const reward = bpData.rewards.find(r => r.level === targetLevel);
  if (!reward) return res.status(404).json({ error: "No reward at this level" });

  // Grant reward
  const granted = { type: reward.type, level: targetLevel };

  switch (reward.type) {
    case "gold":
      if (!user.currencies) user.currencies = {};
      user.currencies.gold = (user.currencies.gold ?? user.gold ?? 0) + reward.amount;
      if (user.gold !== undefined) user.gold = user.currencies.gold;
      granted.amount = reward.amount;
      break;
    case "essenz":
      if (!user.currencies) user.currencies = {};
      user.currencies.essenz = (user.currencies.essenz ?? 0) + reward.amount;
      granted.amount = reward.amount;
      break;
    case "runensplitter":
      if (!user.currencies) user.currencies = {};
      user.currencies.runensplitter = (user.currencies.runensplitter ?? 0) + reward.amount;
      granted.amount = reward.amount;
      break;
    case "stardust":
      if (!user.currencies) user.currencies = {};
      user.currencies.stardust = (user.currencies.stardust ?? 0) + reward.amount;
      granted.amount = reward.amount;
      break;
    case "sternentaler":
      if (!user.currencies) user.currencies = {};
      user.currencies.sternentaler = (user.currencies.sternentaler ?? 0) + reward.amount;
      granted.amount = reward.amount;
      break;
    case "mondstaub":
      if (!user.currencies) user.currencies = {};
      user.currencies.mondstaub = (user.currencies.mondstaub ?? 0) + reward.amount;
      granted.amount = reward.amount;
      break;
    case "material":
      if (!user.craftingMaterials) user.craftingMaterials = {};
      user.craftingMaterials[reward.materialId] = (user.craftingMaterials[reward.materialId] ?? 0) + reward.amount;
      granted.amount = reward.amount;
      granted.materialId = reward.materialId;
      break;
    case "title":
      if (!user.earnedTitles) user.earnedTitles = [];
      if (!user.earnedTitles.some(t => t.id === reward.titleId)) {
        user.earnedTitles.push({
          id: reward.titleId,
          name: reward.titleName,
          rarity: reward.titleRarity || "uncommon",
          source: `${bpData.config.seasonName} — Level ${targetLevel}`,
          earnedAt: new Date().toISOString(),
        });
      }
      granted.titleName = reward.titleName;
      granted.titleRarity = reward.titleRarity;
      break;
    case "frame":
      if (!user.unlockedFrames) user.unlockedFrames = [];
      if (!user.unlockedFrames.some(f => f.id === reward.frameId)) {
        user.unlockedFrames.push({
          id: reward.frameId,
          name: reward.frameName,
          color: reward.frameColor || bpData.config.seasonAccent,
          glow: true,
          source: `${bpData.config.seasonName} — Level ${targetLevel}`,
        });
      }
      granted.frameName = reward.frameName;
      break;
  }

  bp.claimedLevels.push(targetLevel);
  bp.level = currentLevel;
  saveUsers();

  res.json({ ok: true, granted });
});

// ─── Helper: Grant battle pass XP (called from various completion flows) ─────

function grantBattlePassXP(user, source, detail) {
  ensureUserBP(user);

  const sources = bpData.xpSources;
  let xpGain = 0;

  switch (source) {
    case "quest_complete": {
      const rarity = detail?.rarity || "common";
      xpGain = sources.quest_complete?.[rarity] || sources.quest_complete?.common || 10;
      break;
    }
    case "ritual_complete":
      xpGain = sources.ritual_complete || 8;
      break;
    case "vow_clean_day":
      xpGain = sources.vow_clean_day || 5;
      break;
    case "daily_mission_milestone": {
      const pts = String(detail?.points || 0);
      xpGain = sources.daily_mission_milestone?.[pts] || 0;
      break;
    }
    case "crafting":
      xpGain = sources.crafting || 5;
      break;
    case "rift_stage":
      xpGain = sources.rift_stage || 20;
      break;
    case "sternenpfad_star":
      xpGain = sources.sternenpfad_star || 10;
      break;
    case "expedition_checkpoint":
      xpGain = sources.expedition_checkpoint || 15;
      break;
    case "companion_pet":
      xpGain = sources.companion_pet || 2;
      break;
    case "login":
      xpGain = sources.login || 5;
      break;
    default:
      xpGain = 0;
  }

  if (xpGain <= 0) return null;

  const bp = user.battlePass;
  const oldLevel = getBPLevel(bp.xp);
  bp.xp += xpGain;
  const newLevel = getBPLevel(bp.xp);
  bp.level = newLevel;

  return {
    xpGained: xpGain,
    totalXp: bp.xp,
    level: newLevel,
    leveledUp: newLevel > oldLevel,
    source,
  };
}

module.exports = router;
module.exports.grantBattlePassXP = grantBattlePassXP;
module.exports.ensureUserBP = ensureUserBP;
