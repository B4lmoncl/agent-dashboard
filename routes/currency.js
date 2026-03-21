/**
 * Currency Routes — Multi-currency system (Gold, Stardust, Essenz, Runensplitter, Gildentaler, Mondstaub)
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { requireApiKey, getMasterKey } = require('../lib/middleware');
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
    return res.status(400).json({ error: 'action, currency und amount sind erforderlich' });
  }
  if (!['earn', 'spend'].includes(action)) {
    return res.status(400).json({ error: 'action muss "earn" oder "spend" sein' });
  }
  // "earn" requires master key to prevent unlimited currency minting
  if (action === 'earn') {
    const master = getMasterKey();
    const callerKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!master || callerKey !== master) {
      return res.status(403).json({ error: 'Earning currency requires master key' });
    }
  }
  ensureUserCurrencies(u);
  if (!(currency in u.currencies)) {
    return res.status(400).json({ error: `Unbekannte Währung: ${currency}` });
  }
  const amt = Math.abs(Math.floor(amount));
  if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  if (action === 'spend') {
    if (u.currencies[currency] < amt) {
      return res.status(400).json({ error: `Nicht genug ${currency}. Hast ${u.currencies[currency]}, brauchst ${amt}` });
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
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { from, to, amount } = req.body;
  if (!from || !to || !amount) {
    return res.status(400).json({ error: 'from, to und amount sind erforderlich' });
  }
  ensureUserCurrencies(u);
  if (!(from in u.currencies) || !(to in u.currencies)) {
    return res.status(400).json({ error: 'Unbekannte Währung' });
  }
  if (from === to) return res.status(400).json({ error: 'Cannot convert to same currency' });

  // Check if pair is allowed
  const rules = state.currencyTemplates.conversionRules || {};
  const pairs = rules.allowedPairs || [];
  const pair = pairs.find(p => p.from === from && p.to === to);
  if (!pair) {
    return res.status(400).json({ error: `Conversion from ${from} to ${to} is not allowed` });
  }

  const amt = Math.abs(Math.floor(amount));
  if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  if (u.currencies[from] < amt) {
    return res.status(400).json({ error: `Nicht genug ${from}. Hast ${u.currencies[from]}, brauchst ${amt}` });
  }

  const taxRate = rules.taxRate || 0.20;
  const received = Math.floor(amt * pair.rate * (1 - taxRate));
  if (received <= 0) {
    return res.status(400).json({ error: 'Betrag zu klein für Konvertierung (nach Steuer)' });
  }

  u.currencies[from] -= amt;
  u.currencies[to] += received;

  saveUsers();
  console.log(`[currency] ${uid} converted ${amt} ${from} → ${received} ${to} (tax ${Math.round(taxRate * 100)}%)`);
  res.json({ ok: true, spent: amt, received, from, to, taxRate, currencies: u.currencies });
});

// GET /api/currency/templates — get all currency definitions
router.get('/api/currency/templates', (req, res) => {
  res.json(state.currencyTemplates);
});

// ─── Daily Bonus Claim ──────────────────────────────────────────────────────
// POST /api/daily-bonus/claim — player actively claims daily login rewards
router.post('/api/daily-bonus/claim', requireApiKey, (req, res) => {
  const uid = (req.body.player || req.body.playerId || '').toLowerCase();
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

  // Sternentaler are ONLY earned from weekly challenges — not from daily bonus

  // Streak milestone bonus rewards
  let milestoneBonus = null;
  if (milestone && streakDays > 0) {
    // Award extra currency based on streak length
    if (streakDays >= 30) { rewards.runensplitter += 3; rewards.essenz += 5; milestoneBonus = milestone; }
    else if (streakDays >= 14) { rewards.runensplitter += 2; rewards.essenz += 2; milestoneBonus = milestone; }
    else if (streakDays >= 7) { rewards.runensplitter += 1; rewards.essenz += 1; milestoneBonus = milestone; }
  }

  // Apply rewards
  for (const [currency, amount] of Object.entries(rewards)) {
    awardCurrency(uid, currency, amount);
  }

  saveUsers();
  res.json({
    ok: true,
    rewards,
    streakDays,
    milestone: milestoneBonus,
    currencies: u.currencies,
    claimedAt: now(),
  });
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
