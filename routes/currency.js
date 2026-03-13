/**
 * Currency Routes — Multi-currency system (Gold, Stardust, Essenz, Runensplitter, Gildentaler, Mondstaub)
 */
const router = require('express').Router();
const { state, saveUsers } = require('../lib/state');
const { requireApiKey } = require('../lib/middleware');

const DEFAULT_CURRENCIES = { gold: 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 };

function ensureCurrencies(u) {
  if (!u.currencies) u.currencies = { ...DEFAULT_CURRENCIES, gold: u.gold || 0 };
  // Ensure all keys exist
  for (const key of Object.keys(DEFAULT_CURRENCIES)) {
    if (u.currencies[key] === undefined) u.currencies[key] = 0;
  }
  // Keep gold in sync
  u.currencies.gold = u.gold || 0;
  return u.currencies;
}

// GET /api/currency/:playerId — read all balances
router.get('/api/currency/:playerId', (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Spieler nicht gefunden' });
  const currencies = ensureCurrencies(u);
  res.json({ playerId: uid, currencies });
});

// POST /api/currency/:playerId — earn or spend currency
// body: { action: "earn" | "spend", currency: string, amount: number, reason?: string }
router.post('/api/currency/:playerId', requireApiKey, (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Spieler nicht gefunden' });

  const { action, currency, amount, reason } = req.body;
  if (!action || !currency || !amount) {
    return res.status(400).json({ error: 'action, currency und amount sind erforderlich' });
  }
  if (!['earn', 'spend'].includes(action)) {
    return res.status(400).json({ error: 'action muss "earn" oder "spend" sein' });
  }
  const currencies = ensureCurrencies(u);
  if (!(currency in currencies)) {
    return res.status(400).json({ error: `Unbekannte Währung: ${currency}` });
  }
  const amt = Math.abs(Math.floor(amount));
  if (amt <= 0) return res.status(400).json({ error: 'Betrag muss positiv sein' });

  if (action === 'spend') {
    if (currencies[currency] < amt) {
      return res.status(400).json({ error: `Nicht genug ${currency}. Hast ${currencies[currency]}, brauchst ${amt}` });
    }
    currencies[currency] -= amt;
  } else {
    currencies[currency] += amt;
  }

  // Keep gold field in sync
  if (currency === 'gold') u.gold = currencies.gold;

  saveUsers();
  console.log(`[currency] ${uid} ${action} ${amt} ${currency} (${reason || 'no reason'})`);
  res.json({ ok: true, currencies });
});

// POST /api/currency/:playerId/convert — convert between currencies (20% tax)
// body: { from: string, to: string, amount: number }
router.post('/api/currency/:playerId/convert', requireApiKey, (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Spieler nicht gefunden' });

  const { from, to, amount } = req.body;
  if (!from || !to || !amount) {
    return res.status(400).json({ error: 'from, to und amount sind erforderlich' });
  }
  const currencies = ensureCurrencies(u);
  if (!(from in currencies) || !(to in currencies)) {
    return res.status(400).json({ error: 'Unbekannte Währung' });
  }
  if (from === to) return res.status(400).json({ error: 'Kann nicht in gleiche Währung konvertieren' });

  // Check if pair is allowed
  const rules = state.currencyTemplates.conversionRules || {};
  const pairs = rules.allowedPairs || [];
  const pair = pairs.find(p => p.from === from && p.to === to);
  if (!pair) {
    return res.status(400).json({ error: `Konvertierung von ${from} zu ${to} ist nicht erlaubt` });
  }

  const amt = Math.abs(Math.floor(amount));
  if (amt <= 0) return res.status(400).json({ error: 'Betrag muss positiv sein' });
  if (currencies[from] < amt) {
    return res.status(400).json({ error: `Nicht genug ${from}. Hast ${currencies[from]}, brauchst ${amt}` });
  }

  const taxRate = rules.taxRate || 0.20;
  const received = Math.floor(amt * pair.rate * (1 - taxRate));
  if (received <= 0) {
    return res.status(400).json({ error: 'Betrag zu klein für Konvertierung (nach Steuer)' });
  }

  currencies[from] -= amt;
  currencies[to] += received;

  // Keep gold in sync
  if (from === 'gold' || to === 'gold') u.gold = currencies.gold;

  saveUsers();
  console.log(`[currency] ${uid} converted ${amt} ${from} → ${received} ${to} (tax ${Math.round(taxRate * 100)}%)`);
  res.json({ ok: true, spent: amt, received, from, to, taxRate, currencies });
});

// GET /api/currency/templates — get all currency definitions
router.get('/api/currency/templates', (req, res) => {
  res.json(state.currencyTemplates);
});

module.exports = router;
