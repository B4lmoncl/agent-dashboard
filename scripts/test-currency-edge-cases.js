#!/usr/bin/env node
/**
 * Currency Edge-Case Tests
 * Tests: negative amounts, spending more than owned, double daily claim,
 *        currency conversion edge cases, integer overflow attempts
 *
 * Usage: node scripts/test-currency-edge-cases.js
 */

const BASE = process.env.BASE_URL || 'http://localhost:3001';
let PASS = 0, FAIL = 0, SKIP = 0;

async function api(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(`${BASE}${path}`, opts);
    const data = await r.json().catch(() => null);
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    return { status: 0, ok: false, data: null, error: e.message };
  }
}

function assert(name, condition, detail) {
  if (condition) { PASS++; console.log(`  ✓ ${name}`); }
  else { FAIL++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function run() {
  console.log('\n═══ Currency Edge-Case Tests ═══\n');

  const apiKey = process.env.API_KEY || process.env.API_KEYS?.split(',')[0];
  if (!apiKey) { console.log('⚠ No API_KEY — skipping'); return; }
  const auth = { 'x-api-key': apiKey };
  const player = process.env.TEST_PLAYER || 'testplayer';

  // 1. Try to spend negative amount
  console.log('1. Spend negative amount');
  const r1 = await api('POST', '/api/currency/transaction', { action: 'spend', currency: 'gold', amount: -100, playerId: player }, auth);
  assert('Negative spend rejected', r1.status === 400, `status=${r1.status} data=${JSON.stringify(r1.data)}`);

  // 2. Try to spend 0 amount
  console.log('\n2. Spend zero amount');
  const r2 = await api('POST', '/api/currency/transaction', { action: 'spend', currency: 'gold', amount: 0, playerId: player }, auth);
  assert('Zero spend rejected', r2.status === 400, `status=${r2.status}`);

  // 3. Try to spend more than owned
  console.log('\n3. Spend more than balance');
  const r3 = await api('POST', '/api/currency/transaction', { action: 'spend', currency: 'essenz', amount: 999999, playerId: player }, auth);
  assert('Over-spend rejected', r3.status === 400, `status=${r3.status}`);

  // 4. Invalid currency name
  console.log('\n4. Invalid currency');
  const r4 = await api('POST', '/api/currency/transaction', { action: 'spend', currency: 'bitcoin', amount: 1, playerId: player }, auth);
  assert('Invalid currency rejected', r4.status === 400 || r4.status === 404, `status=${r4.status}`);

  // 5. Try integer overflow
  console.log('\n5. Integer overflow attempt');
  const r5 = await api('POST', '/api/currency/transaction', { action: 'earn', currency: 'gold', amount: Number.MAX_SAFE_INTEGER, playerId: player }, auth);
  // This should either be rejected or capped — shouldn't crash
  assert('Overflow handled gracefully', r5.status !== 500, `status=${r5.status}`);

  // 6. Daily bonus double claim
  console.log('\n6. Daily bonus double claim');
  const r6a = await api('POST', '/api/daily-bonus/claim', { player }, auth);
  const r6b = await api('POST', '/api/daily-bonus/claim', { player }, auth);
  // Second should be 409 (already claimed) or first might be 404 (player not found)
  if (r6a.status === 404) {
    console.log('  ⚠ Test player not found — skipping');
    SKIP++;
  } else {
    assert('Double daily claim returns 409', r6b.status === 409, `first=${r6a.status} second=${r6b.status}`);
  }

  // 7. Currency conversion with invalid currencies
  console.log('\n7. Invalid currency conversion');
  const r7 = await api('POST', '/api/currency/convert', { from: 'gold', to: 'gold', amount: 10, playerId: player }, auth);
  assert('Same-currency conversion rejected', r7.status === 400, `status=${r7.status}`);

  // 8. Earn with missing action field
  console.log('\n8. Missing action field');
  const r8 = await api('POST', '/api/currency/transaction', { currency: 'gold', amount: 10, playerId: player }, auth);
  assert('Missing action rejected', r8.status === 400, `status=${r8.status}`);

  // 9. Non-numeric amount (string)
  console.log('\n9. String amount');
  const r9 = await api('POST', '/api/currency/transaction', { action: 'earn', currency: 'gold', amount: 'lots', playerId: player }, auth);
  assert('String amount handled', r9.status === 400 || r9.status === 200, `status=${r9.status}`);

  console.log(`\n═══ Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ═══\n`);
  if (FAIL > 0) process.exit(1);
}

run().catch(e => { console.error('Test runner failed:', e); process.exit(1); });
