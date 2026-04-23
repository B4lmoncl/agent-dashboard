/**
 * Currency Routes — Multi-currency system (Gold, Stardust, Essenz, Runensplitter, Gildentaler, Mondstaub)
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');

// ─── Player locks (prevents concurrent mutations) ──────────────────────────
const { createPlayerLock } = require('../lib/helpers');
const dailyLock = createPlayerLock('daily-bonus');
const currencyLock = createPlayerLock('currency-mutation');
// Legacy aliases
function acquireDailyLock(uid) { return dailyLock.acquire(uid); }
function releaseDailyLock(uid) { dailyLock.release(uid); }
const { requireApiKey } = require('../lib/middleware');
const { now, awardCurrency, getStreakMilestone, getTodayBerlin } = require('../lib/helpers');

// GET /api/currency/:playerId — read all balances
router.get('/api/currency/:playerId', (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  ensureUserCurrencies(u);
  res.json({ playerId: uid, currencies: u.currencies });
});

// POST /api/currency/:playerId — earn or spend currency
// body: { action: "earn" | "spend", currency: string, amount: number, reason?: string }
router.post('/api/currency/:playerId', requireApiKey, (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { action, currency, amount, reason } = req.body;
  if (!action || !currency || !amount) {
    return res.status(400).json({ error: 'action, currency and amount are required' });
  }
  if (!['earn', 'spend'].includes(action)) {
    return res.status(400).json({ error: 'action must be "earn" or "spend"' });
  }
  // "earn" requires admin (master key) to prevent unlimited currency minting
  if (action === 'earn') {
    if (!req.auth?.isAdmin) {
      return res.status(403).json({ error: 'Earning currency requires master key' });
    }
  }
  // "spend" requires self or admin
  if (action === 'spend') {
    const callerId = req.auth?.userId?.toLowerCase();
    if (!req.auth?.isAdmin && callerId !== uid) {
      return res.status(403).json({ error: 'You can only spend your own currency' });
    }
  }
  ensureUserCurrencies(u);
  if (!(currency in u.currencies)) {
    return res.status(400).json({ error: `Unknown currency: ${currency}` });
  }
  if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
  const amt = Math.min(1000000, Math.floor(amount));
  if (amt <= 0) return res.status(400).json({ error: 'Amount too small' });

  if (action === 'spend') {
    if (u.currencies[currency] < amt) {
      return res.status(400).json({ error: `Not enough ${currency}. Have ${u.currencies[currency]}, need ${amt}` });
    }
    u.currencies[currency] -= amt;
  } else {
    u.currencies[currency] += amt;
  }

  saveUsers();
  console.log(`[currency] ${uid} ${action} ${amt} ${currency} (${reason || 'no reason'})`);
  res.json({ ok: true, currencies: u.currencies });
});

// POST /api/currency/:playerId/convert — convert between currencies (20% tax)
// body: { from: string, to: string, amount: number }
router.post('/api/currency/:playerId/convert', requireApiKey, (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!currencyLock.acquire(uid)) return res.status(429).json({ error: 'Currency operation in progress' });
  try {
  // Self-check: only convert own currency (admin bypass)
  const callerId = req.auth?.userId?.toLowerCase();
  if (!req.auth?.isAdmin && callerId !== uid) {
    return res.status(403).json({ error: 'You can only convert your own currency' });
  }
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { from, to, amount } = req.body;
  if (!from || !to || !amount) {
    return res.status(400).json({ error: 'from, to and amount are required' });
  }
  ensureUserCurrencies(u);
  if (!(from in u.currencies) || !(to in u.currencies)) {
    return res.status(400).json({ error: 'Unknown currency' });
  }
  if (from === to) return res.status(400).json({ error: 'Cannot convert to same currency' });

  // Check if pair is allowed
  const rules = state.currencyTemplates.conversionRules || {};
  const pairs = rules.allowedPairs || [];
  const pair = pairs.find(p => p.from === from && p.to === to);
  if (!pair) {
    return res.status(400).json({ error: `Conversion from ${from} to ${to} is not allowed` });
  }

  if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
  const amt = Math.min(1000000, Math.floor(amount));
  if (amt <= 0) return res.status(400).json({ error: 'Amount too small' });
  if (u.currencies[from] < amt) {
    return res.status(400).json({ error: `Not enough ${from}. Have ${u.currencies[from]}, need ${amt}` });
  }

  const taxRate = rules.taxRate || 0.20;
  const received = Math.floor(amt * pair.rate * (1 - taxRate));
  if (received <= 0) {
    return res.status(400).json({ error: 'Amount too small for conversion (after tax)' });
  }

  u.currencies[from] -= amt;
  u.currencies[to] += received;

  u._currencyConversions = (u._currencyConversions || 0) + 1;
  saveUsers();
  console.log(`[currency] ${uid} converted ${amt} ${from} → ${received} ${to} (tax ${Math.round(taxRate * 100)}%)`);
  res.json({ ok: true, spent: amt, received, from, to, taxRate, currencies: u.currencies });
  } finally { currencyLock.release(uid); }
});

// GET /api/currency/templates — get all currency definitions
router.get('/api/currency/templates', (req, res) => {
  res.json(state.currencyTemplates);
});

// ─── Daily Bonus Claim ──────────────────────────────────────────────────────
// POST /api/daily-bonus/claim — player actively claims daily login rewards
router.post('/api/daily-bonus/claim', requireApiKey, (req, res) => {
  const uid = (req.body.player || req.body.playerId || '').toLowerCase();
  // Self-check: only claim own daily bonus (admin bypass)
  const callerId = req.auth?.userId?.toLowerCase();
  if (!req.auth?.isAdmin && callerId !== uid) {
    return res.status(403).json({ error: 'You can only claim your own daily bonus' });
  }
  if (!acquireDailyLock(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  ensureUserCurrencies(u);

  const today = getTodayBerlin();
  if (u.dailyBonusLastClaim === today) {
    return res.status(409).json({ error: 'Daily Bonus already claimed', alreadyClaimed: true });
  }

  u.dailyBonusLastClaim = today;
  if (!u.dailyClaimHistory) u.dailyClaimHistory = [];
  if (!u.dailyClaimHistory.includes(today)) u.dailyClaimHistory.push(today);
  // Keep only last 90 days of history
  if (u.dailyClaimHistory.length > 90) u.dailyClaimHistory = u.dailyClaimHistory.slice(-90);
  const streakDays = u.streakDays || 0;
  const milestone = getStreakMilestone(streakDays);

  // Base daily rewards
  const rewards = {
    essenz: 3,
    runensplitter: 2,
  };

  // Daily Fortune: small chance for bonus rewards (variable reward = dopamine)
  // 20% chance for bonus gold, 10% for bonus stardust, 5% for bonus sternentaler
  // Fortune rewards are tracked separately and awarded via the main loop below.
  const fortuneRoll = Math.random();
  let dailyFortune = null;
  if (fortuneRoll < 0.05) {
    rewards.sternentaler = 1;
    dailyFortune = { type: "sternentaler", amount: 1, label: "Lucky Star!" };
  } else if (fortuneRoll < 0.15) {
    const stardustAmt = 3 + Math.floor(Math.random() * 5); // 3-7
    rewards.stardust = stardustAmt;
    dailyFortune = { type: "stardust", amount: stardustAmt, label: "Starfall!" };
  } else if (fortuneRoll < 0.35) {
    const goldAmt = 10 + Math.floor(Math.random() * 20); // 10-29
    rewards.gold = goldAmt;
    dailyFortune = { type: "gold", amount: goldAmt, label: "Gold Rush!" };
  }

  // Sternentaler are ONLY earned from weekly challenges — not from daily bonus (except fortune)

  // Streak milestone bonus rewards (fire ONLY on the exact milestone day, not every day after)
  let milestoneBonus = null;
  if (milestone && streakDays > 0) {
    if (streakDays === 30 || streakDays === 60 || streakDays === 90) { rewards.runensplitter += 3; rewards.essenz += 5; milestoneBonus = milestone; }
    else if (streakDays === 14 || streakDays === 21) { rewards.runensplitter += 2; rewards.essenz += 2; milestoneBonus = milestone; }
    else if (streakDays === 7) { rewards.runensplitter += 1; rewards.essenz += 1; milestoneBonus = milestone; }
  }

  // Apply rewards
  for (const [currency, amount] of Object.entries(rewards)) {
    awardCurrency(uid, currency, amount);
  }

  // Battle Pass XP
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'login'); } catch (e) { console.warn('[bp-xp] login:', e.message); }

  saveUsers();
  res.json({
    ok: true,
    rewards,
    streakDays,
    milestone: milestoneBonus,
    dailyFortune,
    currencies: u.currencies,
    claimedAt: now(),
  });
  } finally { releaseDailyLock(uid); }
});

// GET /api/daily-bonus/status/:playerId — check if daily bonus is available
router.get('/api/daily-bonus/status/:playerId', (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const today = getTodayBerlin();
  const claimed = u.dailyBonusLastClaim === today;
  res.json({ available: !claimed, lastClaim: u.dailyBonusLastClaim || null, streakDays: u.streakDays || 0, claimHistory: u.dailyClaimHistory || [] });
});

module.exports = router;
