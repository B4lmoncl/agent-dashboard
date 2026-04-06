const express = require("express");
const router = express.Router();
const { state, saveUsers, ensureUserCurrencies } = require("../lib/state");
const { requireAuth } = require("../lib/middleware");
const { getLevelInfo, createPlayerLock } = require("../lib/helpers");
const tomeClaimLock = createPlayerLock('tome-claim');

// ─── Adventure Tome: Per-floor completionist tracker ───────────────────────
// Inspired by Lost Ark's Adventure Tome. Tracks completion % per tower floor
// with milestone rewards at 25%, 50%, 75%, 100%.

// ─── Floor definitions with trackable objectives ───────────────────────────
const FLOORS = [
  {
    id: "haupthalle",
    name: "Great Halls",
    subtitle: "Adventure",
    color: "#f97316",
    objectives: [
      { id: "quests_completed_10",  type: "counter", label: "10 Quests abgeschlossen",        target: 10,  stat: "questsCompleted" },
      { id: "quests_completed_50",  type: "counter", label: "50 Quests abgeschlossen",        target: 50,  stat: "questsCompleted" },
      { id: "quests_completed_200", type: "counter", label: "200 Quests abgeschlossen",       target: 200, stat: "questsCompleted" },
      { id: "rift_normal_clear",    type: "counter", label: "Normal Rift abgeschlossen",      target: 1,   stat: "_riftsCompleted" },
      { id: "rift_hard_clear",      type: "counter", label: "Hard Rift abgeschlossen",        target: 1,   stat: "_riftsHard" },
      { id: "rift_legend_clear",    type: "counter", label: "Legendary Rift abgeschlossen",   target: 1,   stat: "_riftsLegendary" },
      { id: "mythic_plus_5",        type: "counter", label: "Mythic+5 erreicht",              target: 5,   stat: "_mythicPlusHighest" },
      { id: "dungeon_clear_1",      type: "counter", label: "Ersten Dungeon abgeschlossen",   target: 1,   stat: "_dungeonsCompleted" },
      { id: "dungeon_clear_5",      type: "counter", label: "5 Dungeons abgeschlossen",       target: 5,   stat: "_dungeonsCompleted" },
      { id: "worldboss_kill_1",     type: "counter", label: "Ersten World Boss besiegt",      target: 1,   stat: "_worldBossKills" },
      { id: "worldboss_top3",       type: "counter", label: "Top 3 beim World Boss",          target: 1,   stat: "_worldBossTop3" },
      { id: "challenge_9stars",     type: "counter", label: "9 Sterne in einer Woche",        target: 1,   stat: "_challenge9Stars" },
    ],
    milestones: [
      { pct: 25,  reward: { gold: 200 },                         label: "25% — 200 Gold" },
      { pct: 50,  reward: { gold: 500, essenz: 100 },            label: "50% — 500 Gold, 100 Essenz" },
      { pct: 75,  reward: { gold: 1000, runensplitter: 50 },     label: "75% — 1000 Gold, 50 Runensplitter" },
      { pct: 100, reward: { gold: 2000, title: "Hallenmeister" }, label: "100% — 2000 Gold + Titel: Hallenmeister" },
    ],
  },
  {
    id: "gewerbeviertel",
    name: "Trading District",
    subtitle: "Commerce & Craft",
    color: "#a855f7",
    objectives: [
      { id: "craft_first",           type: "counter", label: "Erstes Item gecraftet",           target: 1,   stat: "_craftsCompleted" },
      { id: "craft_50",              type: "counter", label: "50 Items gecraftet",              target: 50,  stat: "_craftsCompleted" },
      { id: "profession_level_5",    type: "counter", label: "Profession auf Level 5",          target: 5,   stat: "_professionMaxLevel" },
      { id: "profession_level_10",   type: "counter", label: "Profession auf Level 10",         target: 10,  stat: "_professionMaxLevel" },
      { id: "gacha_pull_10",         type: "counter", label: "10 Gacha-Pulls",                  target: 10,  stat: "_gachaPulls" },
      { id: "gacha_pull_50",         type: "counter", label: "50 Gacha-Pulls",                  target: 50,  stat: "_gachaPulls" },
      { id: "gacha_legendary",       type: "counter", label: "Legendäres Gacha-Item",           target: 1,   stat: "_gachaLegendary" },
      { id: "shop_purchase_10",      type: "counter", label: "10 Shop-Käufe",                   target: 10,  stat: "_shopPurchases" },
      { id: "kanai_extract_1",       type: "counter", label: "Ersten Legendary-Effekt extrahiert", target: 1, stat: "_kanaiExtracts" },
      { id: "transmute_1",           type: "counter", label: "Erste Transmutation",             target: 1,   stat: "_transmutations" },
      { id: "enchant_1",             type: "counter", label: "Erste Verzauberung",              target: 1,   stat: "_enchantments" },
      { id: "salvage_100",           type: "counter", label: "100 Items zerlegt",               target: 100, stat: "_salvageCount" },
    ],
    milestones: [
      { pct: 25,  reward: { gold: 200, essenz: 50 },              label: "25% — 200 Gold, 50 Essenz" },
      { pct: 50,  reward: { gold: 500, runensplitter: 30 },       label: "50% — 500 Gold, 30 Runensplitter" },
      { pct: 75,  reward: { gold: 1000, stardust: 200 },          label: "75% — 1000 Gold, 200 Stardust" },
      { pct: 100, reward: { gold: 2000, title: "Handelsmeister" }, label: "100% — 2000 Gold + Titel: Handelsmeister" },
    ],
  },
  {
    id: "charakterturm",
    name: "Inner Sanctum",
    subtitle: "Personal",
    color: "#3b82f6",
    objectives: [
      { id: "level_10",            type: "counter", label: "Level 10 erreicht",             target: 10,  stat: "_level" },
      { id: "level_25",            type: "counter", label: "Level 25 erreicht",             target: 25,  stat: "_level" },
      { id: "level_50",            type: "counter", label: "Level 50 erreicht",             target: 50,  stat: "_level" },
      { id: "ritual_streak_7",     type: "counter", label: "7-Tage Ritual-Streak",          target: 7,   stat: "_maxRitualStreak" },
      { id: "ritual_streak_30",    type: "counter", label: "30-Tage Ritual-Streak",         target: 30,  stat: "_maxRitualStreak" },
      { id: "codex_entries_25",    type: "counter", label: "25 Codex-Einträge gelesen",     target: 25,  stat: "_codexRead" },
      { id: "codex_entries_all",   type: "counter", label: "Alle Codex-Einträge gelesen",   target: 95,  stat: "_codexRead" },
      { id: "companion_bond_3",    type: "counter", label: "Companion Bond Level 3",        target: 3,   stat: "_companionBondMax" },
      { id: "companion_bond_5",    type: "counter", label: "Companion Bond Level 5",        target: 5,   stat: "_companionBondMax" },
      { id: "streak_60",           type: "counter", label: "60-Tage Quest-Streak",           target: 60,  stat: "streakDays" },
      { id: "vow_complete_1",      type: "counter", label: "Ersten Schwur abgeschlossen",   target: 1,   stat: "_vowsCompleted" },
      { id: "achievements_20",     type: "counter", label: "20 Achievements freigeschaltet", target: 20,  stat: "_achievementCount" },
    ],
    milestones: [
      { pct: 25,  reward: { gold: 150, stardust: 100 },          label: "25% — 150 Gold, 100 Stardust" },
      { pct: 50,  reward: { gold: 400, essenz: 150 },            label: "50% — 400 Gold, 150 Essenz" },
      { pct: 75,  reward: { gold: 800, sternentaler: 20 },       label: "75% — 800 Gold, 20 Sternentaler" },
      { pct: 100, reward: { gold: 1500, title: "Turmwächter" },  label: "100% — 1500 Gold + Titel: Turmwächter" },
    ],
  },
  {
    id: "breakaway",
    name: "Breakaway",
    subtitle: "Social & Rest",
    color: "#ec4899",
    objectives: [
      { id: "friends_3",           type: "counter", label: "3 Freunde hinzugefügt",         target: 3,   stat: "_friendsCount" },
      { id: "friends_10",          type: "counter", label: "10 Freunde hinzugefügt",        target: 10,  stat: "_friendsCount" },
      { id: "messages_sent_10",    type: "counter", label: "10 Nachrichten gesendet",       target: 10,  stat: "_messagesSent" },
      { id: "trades_completed_3",  type: "counter", label: "3 Trades abgeschlossen",        target: 3,   stat: "_tradesCompleted" },
      { id: "tavern_rest_1",       type: "counter", label: "Ersten Tavern-Rest genommen",   target: 1,   stat: "_tavernRests" },
      { id: "expedition_complete_5", type: "counter", label: "5 Companion-Expeditionen",     target: 5,   stat: "_expeditionsCompleted" },
      { id: "mail_sent_5",         type: "counter", label: "5 Mails verschickt",            target: 5,   stat: "_mailSent" },
      { id: "trade_gold_1000",     type: "counter", label: "1000 Gold gehandelt",           target: 1000, stat: "_goldTraded" },
    ],
    milestones: [
      { pct: 25,  reward: { gold: 150 },                          label: "25% — 150 Gold" },
      { pct: 50,  reward: { gold: 300, runensplitter: 20 },       label: "50% — 300 Gold, 20 Runensplitter" },
      { pct: 75,  reward: { gold: 600, stardust: 150 },           label: "75% — 600 Gold, 150 Stardust" },
      { pct: 100, reward: { gold: 1000, title: "Seelenverwandt" }, label: "100% — 1000 Gold + Titel: Seelenverwandt" },
    ],
  },
  {
    id: "turmspitze",
    name: "Pinnacle",
    subtitle: "Prestige & Glory",
    color: "#fbbf24",
    objectives: [
      { id: "faction_honored",     type: "counter", label: "Geehrt bei einer Fraktion",     target: 1,   stat: "_factionsHonored" },
      { id: "faction_exalted",     type: "counter", label: "Erhaben bei einer Fraktion",    target: 1,   stat: "_factionsExalted" },
      { id: "season_level_20",     type: "counter", label: "Season Pass Level 20",           target: 20,  stat: "_seasonPassLevel" },
      { id: "season_level_40",     type: "counter", label: "Season Pass Level 40",           target: 40,  stat: "_seasonPassLevel" },
      { id: "leaderboard_top10",   type: "counter", label: "Top 10 im Leaderboard",         target: 1,   stat: "_leaderboardTop10" },
      { id: "campaign_complete_1", type: "counter", label: "Erste Kampagne abgeschlossen",  target: 1,   stat: "_campaignsCompleted" },
      { id: "expedition_bonus",    type: "counter", label: "Expedition Bonus-Checkpoint",    target: 1,   stat: "_expeditionBonus" },
      { id: "mythic_plus_10",      type: "counter", label: "Mythic+10 erreicht",             target: 10,  stat: "_mythicPlusHighest" },
      { id: "gear_score_500",      type: "counter", label: "Gear Score 500 erreicht",        target: 500, stat: "_gearScore" },
      { id: "all_floors_75",       type: "special", label: "Alle anderen Floors auf 75%",    target: 4,   stat: "_floorsAt75" },
    ],
    milestones: [
      { pct: 25,  reward: { gold: 300, sternentaler: 10 },        label: "25% — 300 Gold, 10 Sternentaler" },
      { pct: 50,  reward: { gold: 750, runensplitter: 50 },       label: "50% — 750 Gold, 50 Runensplitter" },
      { pct: 75,  reward: { gold: 1500, essenz: 300 },            label: "75% — 1500 Gold, 300 Essenz" },
      { pct: 100, reward: { gold: 3000, title: "Turmkronenwächter", frame: "pinnacle_master" }, label: "100% — 3000 Gold + Titel & Frame" },
    ],
  },
];

// ─── Evaluate player progress for a floor ──────────────────────────────────
function evaluateFloor(floor, user, progress) {
  const lvl = getLevelInfo(user.xp || 0).level;
  const results = [];

  // Cache talent effect outside loop (called per-objective otherwise)
  const { getUserTalentEffects } = require('./talent-tree');
  const tomeBonus = getUserTalentEffects(user.name?.toLowerCase() || user.id)?.tome_progress_bonus;
  const tomeBonusValue = (tomeBonus && typeof tomeBonus === 'object') ? (tomeBonus.value || 0) : (typeof tomeBonus === 'number' ? tomeBonus : 0);

  for (const obj of floor.objectives) {
    let current = 0;

    if (obj.type === "counter") {
      switch (obj.stat) {
        case "questsCompleted":
          current = user.questsCompleted || 0;
          break;
        case "_level":
          current = lvl;
          break;
        case "streakDays":
          current = user.streakDays || 0;
          break;
        case "_riftsCompleted":
          current = user._riftsCompleted || 0;
          break;
        case "_riftsHard":
          current = user._riftsHard || 0;
          break;
        case "_riftsLegendary":
          current = user._riftsLegendary || 0;
          break;
        case "_mythicPlusHighest":
          current = user._mythicPlusHighest || 0;
          break;
        case "_dungeonsCompleted":
          current = user._dungeonsCompleted || 0;
          break;
        case "_worldBossKills":
          current = user._worldBossKills || 0;
          break;
        case "_worldBossTop3":
          current = user._worldBossTop3 || 0;
          break;
        case "_challenge9Stars":
          current = user._challenge9Stars || 0;
          break;
        case "_craftsCompleted":
          current = user._craftsCompleted || 0;
          break;
        case "_professionMaxLevel": {
          const profs = progress?.professions || {};
          let maxLvl = 0;
          for (const p of Object.values(profs)) {
            if (p && typeof p === 'object' && (p.level || 0) > maxLvl) maxLvl = p.level;
          }
          current = maxLvl;
          break;
        }
        case "_gachaPulls":
          current = user._gachaPulls || 0;
          break;
        case "_gachaLegendary":
          current = user._gachaLegendary || 0;
          break;
        case "_shopPurchases":
          current = user._shopPurchases || 0;
          break;
        case "_kanaiExtracts":
          current = user._kanaiExtracts || 0;
          break;
        case "_transmutations":
          current = user._transmutations || 0;
          break;
        case "_enchantments":
          current = user._enchantments || 0;
          break;
        case "_salvageCount":
          current = user._salvageCount || 0;
          break;
        case "_maxRitualStreak": {
          const rituals = state.rituals?.[user.name?.toLowerCase()] || [];
          let maxStreak = 0;
          for (const r of rituals) {
            if ((r.streak || 0) > maxStreak) maxStreak = r.streak;
          }
          current = maxStreak;
          break;
        }
        case "_codexRead":
          current = user._codexRead || 0;
          break;
        case "_companionBondMax":
          current = user._companionBondMax || 0;
          break;
        case "_vowsCompleted":
          current = user._vowsCompleted || 0;
          break;
        case "_achievementCount":
          current = (user.achievements || []).length;
          break;
        case "_friendsCount": {
          const social = state.social || {};
          const friends = social.friends || {};
          const uid = user.name?.toLowerCase();
          current = uid ? (friends[uid] || []).filter(f => f.status === 'accepted').length : 0;
          break;
        }
        case "_messagesSent":
          current = user._messagesSent || 0;
          break;
        case "_tradesCompleted":
          current = user._tradesCompleted || 0;
          break;
        case "_tavernRests":
          current = user._tavernRests || 0;
          break;
        case "_expeditionsCompleted":
          current = user._expeditionsCompleted || 0;
          break;
        case "_mailSent":
          current = user._mailSent || 0;
          break;
        case "_goldTraded":
          current = user._goldTraded || 0;
          break;
        case "_factionsHonored":
          current = user._factionsHonored || 0;
          break;
        case "_factionsExalted":
          current = user._factionsExalted || 0;
          break;
        case "_seasonPassLevel":
          current = user.battlePass?.level || 0;
          break;
        case "_leaderboardTop10":
          current = user._leaderboardTop10 || 0;
          break;
        case "_campaignsCompleted":
          current = user._campaignsCompleted || 0;
          break;
        case "_expeditionBonus":
          current = user._expeditionBonus || 0;
          break;
        case "_gearScore":
          current = user._gearScore || 0;
          break;
        default:
          current = user[obj.stat] || 0;
      }
    } else if (obj.type === "special" && obj.stat === "_floorsAt75") {
      // Count other floors at 75%+
      let count = 0;
      for (const f of FLOORS) {
        if (f.id === floor.id) continue;
        const fResult = evaluateFloor(f, user, progress);
        if (fResult.percentage >= 75) count++;
      }
      current = count;
    }

    // Talent: tome_progress_bonus — adds flat bonus to each objective's counter
    if (tomeBonusValue > 0) current += tomeBonusValue;

    results.push({
      id: obj.id,
      label: obj.label,
      current: Math.min(current, obj.target),
      target: obj.target,
      completed: current >= obj.target,
    });
  }

  const completed = results.filter(r => r.completed).length;
  const total = results.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { objectives: results, completed, total, percentage };
}

// ─── GET /api/adventure-tome — full tome state ─────────────────────────────
router.get('/api/adventure-tome', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  const user = state.users[uid];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const progress = state.playerProgress?.[uid] || {};
  const tomeClaimed = user._tomeClaimed || {};

  const floors = FLOORS.map(floor => {
    const eval_ = evaluateFloor(floor, user, progress);
    const milestones = floor.milestones.map(m => ({
      ...m,
      reached: eval_.percentage >= m.pct,
      claimed: !!tomeClaimed[`${floor.id}_${m.pct}`],
    }));

    return {
      id: floor.id,
      name: floor.name,
      subtitle: floor.subtitle,
      color: floor.color,
      ...eval_,
      milestones,
    };
  });

  const totalPct = Math.round(floors.reduce((s, f) => s + f.percentage, 0) / floors.length);

  res.json({ floors, totalPercentage: totalPct });
});

// ─── POST /api/adventure-tome/claim — claim a milestone reward ─────────────
router.post('/api/adventure-tome/claim', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  if (!tomeClaimLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const user = state.users[uid];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { floorId, pct } = req.body;
  if (!floorId || !pct) return res.status(400).json({ error: 'floorId and pct required' });

  const floor = FLOORS.find(f => f.id === floorId);
  if (!floor) return res.status(400).json({ error: 'Unknown floor' });

  const milestone = floor.milestones.find(m => m.pct === pct);
  if (!milestone) return res.status(400).json({ error: 'Unknown milestone' });

  const progress = state.playerProgress?.[uid] || {};
  const eval_ = evaluateFloor(floor, user, progress);
  if (eval_.percentage < pct) {
    return res.status(400).json({ error: `Floor is at ${eval_.percentage}%, need ${pct}%` });
  }

  if (!user._tomeClaimed) user._tomeClaimed = {};
  const claimKey = `${floorId}_${pct}`;
  if (user._tomeClaimed[claimKey]) {
    return res.status(400).json({ error: 'Already claimed' });
  }

  // Grant rewards
  const reward = milestone.reward;
  const granted = [];
  if (reward.gold) { ensureUserCurrencies(user); user.currencies.gold = (user.currencies.gold || 0) + reward.gold; user.gold = user.currencies.gold; granted.push(`${reward.gold} Gold`); }
  if (reward.essenz) {
    ensureUserCurrencies(user);
    user.currencies.essenz = (user.currencies.essenz || 0) + reward.essenz;
    granted.push(`${reward.essenz} Essenz`);
  }
  if (reward.runensplitter) {
    ensureUserCurrencies(user);
    user.currencies.runensplitter = (user.currencies.runensplitter || 0) + reward.runensplitter;
    granted.push(`${reward.runensplitter} Runensplitter`);
  }
  if (reward.stardust) {
    ensureUserCurrencies(user);
    user.currencies.stardust = (user.currencies.stardust || 0) + reward.stardust;
    granted.push(`${reward.stardust} Stardust`);
  }
  if (reward.sternentaler) {
    ensureUserCurrencies(user);
    user.currencies.sternentaler = (user.currencies.sternentaler || 0) + reward.sternentaler;
    granted.push(`${reward.sternentaler} Sternentaler`);
  }
  if (reward.title) {
    if (!user.earnedTitles) user.earnedTitles = [];
    if (!user.earnedTitles.includes(reward.title)) {
      user.earnedTitles.push(reward.title);
    }
    granted.push(`Titel: ${reward.title}`);
  }
  if (reward.frame) {
    if (!user.earnedFrames) user.earnedFrames = [];
    if (!user.earnedFrames.includes(reward.frame)) {
      user.earnedFrames.push(reward.frame);
    }
    granted.push(`Frame: ${reward.frame}`);
  }

  user._tomeClaimed[claimKey] = new Date().toISOString();
  saveUsers();

  res.json({
    success: true,
    floor: floorId,
    milestone: pct,
    granted,
  });
  } finally { tomeClaimLock.release(uid); }
});

module.exports = router;
