const express = require("express");
const router = express.Router();
const { state, saveUsers, ensureUserCurrencies } = require("../lib/state");
const { requireAuth } = require("../lib/middleware");
const { createPlayerLock } = require("../lib/helpers");
const bpClaimLock = createPlayerLock('bp-claim');
const bpData = require("../public/data/battlePass.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Season epoch: Season 1 starts at this date. Each subsequent season auto-starts
// after seasonDurationDays. Seasons cycle through bpData.seasons[] in order.
const SEASON_EPOCH = new Date("2026-03-01T00:00:00Z").getTime();

function getActiveSeason() {
  const now = Date.now();
  const durationMs = (bpData.settings.seasonDurationDays || 90) * 86400000;
  const elapsed = Math.max(0, now - SEASON_EPOCH);
  const seasonIndex = Math.floor(elapsed / durationMs) % bpData.seasons.length;
  const season = bpData.seasons[seasonIndex];
  const seasonStartMs = SEASON_EPOCH + Math.floor(elapsed / durationMs) * durationMs;
  const seasonEndMs = seasonStartMs + durationMs;
  return {
    ...season,
    levels: bpData.settings.levels,
    xpPerLevel: bpData.settings.xpPerLevel,
    seasonDurationDays: bpData.settings.seasonDurationDays,
    seasonName: season.name,
    seasonTheme: season.theme,
    seasonIcon: season.icon,
    seasonAccent: season.accent,
    currentSeason: season.season,
    seasonStartedAt: new Date(seasonStartMs).toISOString(),
    seasonEndsAt: new Date(seasonEndMs).toISOString(),
  };
}

// Backward-compatible config getter (returns shape matching old bpData.config)
function getConfig() {
  const active = getActiveSeason();
  return {
    levels: active.levels,
    xpPerLevel: active.xpPerLevel,
    seasonDurationDays: active.seasonDurationDays,
    currentSeason: active.currentSeason,
    seasonName: active.seasonName,
    seasonTheme: active.seasonTheme,
    seasonIcon: active.seasonIcon,
    seasonAccent: active.seasonAccent,
  };
}

function getActiveRewards() {
  return getActiveSeason().rewards;
}

function ensureUserBP(user) {
  const config = getConfig();
  if (!user.battlePass) {
    user.battlePass = {
      season: config.currentSeason,
      xp: 0,
      level: 0,
      claimedLevels: [],
      seasonStartedAt: new Date().toISOString(),
    };
  }
  // Reset if new season — preserve unclaimed level info for reference
  if (user.battlePass.season !== config.currentSeason) {
    user.battlePass = {
      season: config.currentSeason,
      xp: 0,
      level: 0,
      claimedLevels: [],
      seasonStartedAt: new Date().toISOString(),
      previousSeason: {
        season: user.battlePass.season,
        level: getBPLevel(user.battlePass.xp),
        claimedLevels: user.battlePass.claimedLevels || [],
      },
    };
  }
  if (!user.battlePass.seasonStartedAt) {
    user.battlePass.seasonStartedAt = new Date().toISOString();
  }
}

function getBPLevel(xp) {
  const config = getConfig();
  return Math.min(Math.floor(xp / config.xpPerLevel), config.levels);
}

// ─── GET /api/battlepass — Current pass state for player ─────────────────────

router.get("/", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserBP(user);

  const config = getConfig();
  const bp = user.battlePass;
  const level = getBPLevel(bp.xp);
  const xpInLevel = bp.xp % config.xpPerLevel;
  const progress = xpInLevel / config.xpPerLevel;

  const activeSeason = getActiveSeason();

  res.json({
    config,
    rewards: activeSeason.rewards,
    xpSources: bpData.xpSources,
    player: {
      xp: bp.xp,
      level,
      xpInLevel,
      xpPerLevel: config.xpPerLevel,
      progress,
      claimedLevels: bp.claimedLevels,
      seasonEnd: activeSeason.seasonEndsAt,
    },
  });
});

// ─── POST /api/battlepass/claim/:level — Claim reward for a level ────────────

router.post("/claim/:level", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!bpClaimLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserBP(user);

  const config = getConfig();
  const targetLevel = parseInt(req.params.level, 10);
  if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > config.levels) {
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

  const reward = getActiveRewards().find(r => r.level === targetLevel);
  if (!reward) return res.status(404).json({ error: "No reward at this level" });

  // Grant reward
  const granted = { type: reward.type, level: targetLevel };

  switch (reward.type) {
    case "gold":
      if (!user.currencies) user.currencies = {};
      user.currencies.gold = (user.currencies.gold ?? user.gold ?? 0) + reward.amount;
      user.gold = user.currencies.gold;
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
          source: `${config.seasonName} — Level ${targetLevel}`,
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
          color: reward.frameColor || config.seasonAccent,
          glow: true,
          source: `${config.seasonName} — Level ${targetLevel}`,
        });
      }
      granted.frameName = reward.frameName;
      break;
  }

  bp.claimedLevels.push(targetLevel);
  bp.level = currentLevel;
  saveUsers();

  res.json({ ok: true, granted });
  } finally { bpClaimLock.release(uid); }
});

// ─── POST /api/battlepass/claim-all — Claim all available unclaimed rewards ───

router.post("/claim-all", requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!bpClaimLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: "User not found" });

  ensureUserBP(user);
  const config = getConfig();
  const bp = user.battlePass;
  const currentLevel = getBPLevel(bp.xp);
  const rewards = getActiveRewards();
  const granted = [];

  for (let lvl = 1; lvl <= Math.min(currentLevel, config.levels); lvl++) {
    if (bp.claimedLevels.includes(lvl)) continue;
    const reward = rewards.find(r => r.level === lvl);
    if (!reward) continue;

    switch (reward.type) {
      case "gold":
        if (!user.currencies) user.currencies = {};
        user.currencies.gold = (user.currencies.gold ?? user.gold ?? 0) + reward.amount;
        user.gold = user.currencies.gold;
        break;
      case "essenz":
        ensureUserCurrencies(user);
        user.currencies.essenz = (user.currencies.essenz ?? 0) + reward.amount;
        break;
      case "runensplitter":
        ensureUserCurrencies(user);
        user.currencies.runensplitter = (user.currencies.runensplitter ?? 0) + reward.amount;
        break;
      case "sternentaler":
        ensureUserCurrencies(user);
        user.currencies.sternentaler = (user.currencies.sternentaler ?? 0) + reward.amount;
        break;
      case "stardust":
        ensureUserCurrencies(user);
        user.currencies.stardust = (user.currencies.stardust ?? 0) + reward.amount;
        break;
      case "mondstaub":
        ensureUserCurrencies(user);
        user.currencies.mondstaub = (user.currencies.mondstaub ?? 0) + reward.amount;
        break;
      case "material":
        user.craftingMaterials = user.craftingMaterials || {};
        user.craftingMaterials[reward.materialId] = (user.craftingMaterials[reward.materialId] ?? 0) + reward.amount;
        break;
      case "title":
        if (!user.earnedTitles) user.earnedTitles = [];
        if (!user.earnedTitles.some(t => t.id === reward.titleId)) {
          user.earnedTitles.push({ id: reward.titleId, name: reward.titleName, rarity: reward.titleRarity || "uncommon", source: `${config.seasonName} — Level ${lvl}`, earnedAt: new Date().toISOString() });
        }
        break;
      case "frame":
        if (!user.unlockedFrames) user.unlockedFrames = [];
        if (!user.unlockedFrames.some(f => f.id === reward.frameId)) {
          user.unlockedFrames.push({ id: reward.frameId, name: reward.frameName, color: reward.frameColor || config.seasonAccent, glow: true, source: `${config.seasonName} — Level ${lvl}` });
        }
        break;
    }
    bp.claimedLevels.push(lvl);
    granted.push({ level: lvl, type: reward.type, name: reward.name || reward.titleName || reward.frameName || `${reward.amount} ${reward.type}` });
  }

  if (granted.length === 0) return res.status(400).json({ error: "Nothing to claim" });

  bp.level = currentLevel;
  saveUsers();
  res.json({ ok: true, count: granted.length, granted });
  } finally { bpClaimLock.release(uid); }
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

  // Talent tree: battlepass_xp_bonus
  const { getUserTalentEffects } = require('./talent-tree');
  const talentBPBonus = getUserTalentEffects(user.id || user.name?.toLowerCase()).battlepass_xp_bonus || 0;
  if (talentBPBonus > 0) xpGain = Math.round(xpGain * (1 + talentBPBonus));

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
module.exports.getActiveSeason = getActiveSeason;
module.exports.getBPLevel = getBPLevel;
