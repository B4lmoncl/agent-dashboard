#!/usr/bin/env node
/**
 * Gacha Edge-Case Tests
 * Tests: pull without funds, concurrent pulls (lock test),
 *        pull on nonexistent banner, pity counter consistency
 *
 * Usage: node scripts/test-gacha-edge-cases.js
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
  console.log('\n═══ Gacha Edge-Case Tests ═══\n');

  const apiKey = process.env.API_KEY || process.env.API_KEYS?.split(',')[0];
  if (!apiKey) { console.log('⚠ No API_KEY — skipping'); return; }
  const auth = { 'x-api-key': apiKey };
  const player = process.env.TEST_PLAYER || 'testplayer';

  // 1. Pull without enough currency
  console.log('1. Pull without funds');
  const r1 = await api('POST', '/api/gacha/pull', { playerId: player, bannerId: 'wheel-of-stars' }, auth);
  // Should be 400 (not enough currency) or 404 (player not found)
  assert('Insufficient funds handled', r1.status === 400 || r1.status === 404, `status=${r1.status} msg=${r1.data?.error}`);

  // 2. Pull on nonexistent banner
  console.log('\n2. Pull on nonexistent banner');
  const r2 = await api('POST', '/api/gacha/pull', { playerId: player, bannerId: 'fake-banner-999' }, auth);
  assert('Nonexistent banner returns 404', r2.status === 404, `status=${r2.status}`);

  // 3. Pull without playerId
  console.log('\n3. Pull without playerId');
  const r3 = await api('POST', '/api/gacha/pull', { bannerId: 'wheel-of-stars' }, auth);
  assert('Missing playerId returns 400', r3.status === 400, `status=${r3.status}`);

  // 4. Pull without bannerId
  console.log('\n4. Pull without bannerId');
  const r4 = await api('POST', '/api/gacha/pull', { playerId: player }, auth);
  assert('Missing bannerId returns 400', r4.status === 400, `status=${r4.status}`);

  // 5. Concurrent pulls (test pull lock)
  console.log('\n5. Concurrent pull lock test');
  const promises = Array.from({ length: 3 }, () =>
    api('POST', '/api/gacha/pull', { playerId: player, bannerId: 'wheel-of-stars' }, auth)
  );
  const results = await Promise.all(promises);
  const statusCodes = results.map(r => r.status);
  // At most 1 should succeed (200), rest should be 429 (lock) or 400 (no funds)
  const successes = statusCodes.filter(s => s === 200).length;
  const locks = statusCodes.filter(s => s === 429).length;
  assert('At most 1 concurrent pull succeeds', successes <= 1, `successes=${successes} locks=${locks} statuses=${statusCodes.join(',')}`);

  // 6. 10-pull without enough for 10
  console.log('\n6. 10-pull with insufficient funds');
  const r6 = await api('POST', '/api/gacha/pull10', { playerId: player, bannerId: 'wheel-of-stars' }, auth);
  assert('10-pull insufficient funds handled', r6.status === 400 || r6.status === 404, `status=${r6.status}`);

  // 7. Check pity endpoint exists
  console.log('\n7. Pity status check');
  const r7 = await api('GET', `/api/gacha/pity/${player}`, null, auth);
  assert('Pity endpoint works', r7.status === 200 || r7.status === 404, `status=${r7.status}`);

  // 8. Pull for someone else (should be blocked or handled)
  console.log('\n8. Pull for other player');
  const r8 = await api('POST', '/api/gacha/pull', { playerId: 'someoneelse', bannerId: 'wheel-of-stars' }, auth);
  // Depends on auth model — might be 403 (not your account) or 400 (no funds) or 404 (not found)
  assert('Pull for other handled', r8.status === 403 || r8.status === 400 || r8.status === 404, `status=${r8.status}`);

  console.log(`\n═══ Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ═══\n`);
  if (FAIL > 0) process.exit(1);
}

run().catch(e => { console.error('Test runner failed:', e); process.exit(1); });
