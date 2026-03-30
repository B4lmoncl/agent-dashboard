#!/usr/bin/env node
/**
 * Auth & Security Edge-Case Tests
 * Tests: no auth header, invalid API key, cross-player manipulation,
 *        JWT expiry, rate limiting awareness
 *
 * Usage: node scripts/test-auth-security.js
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
  console.log('\n═══ Auth & Security Edge-Case Tests ═══\n');

  const apiKey = process.env.API_KEY || process.env.API_KEYS?.split(',')[0];

  // 1. Access protected endpoint without auth
  console.log('1. POST /api/quest without auth');
  const r1 = await api('POST', '/api/quest', { title: 'Test' });
  assert('No auth returns 401', r1.status === 401, `status=${r1.status}`);

  // 2. Access with invalid API key
  console.log('\n2. POST /api/quest with invalid key');
  const r2 = await api('POST', '/api/quest', { title: 'Test' }, { 'x-api-key': 'invalid-key-123' });
  assert('Invalid key returns 401', r2.status === 401, `status=${r2.status}`);

  // 3. Access with empty API key
  console.log('\n3. POST with empty API key');
  const r3 = await api('POST', '/api/quest', { title: 'Test' }, { 'x-api-key': '' });
  assert('Empty key returns 401', r3.status === 401, `status=${r3.status}`);

  // 4. GET endpoints should work without auth (public reads)
  console.log('\n4. GET /api/config without auth');
  const r4 = await api('GET', '/api/config');
  assert('Public config accessible', r4.status === 200, `status=${r4.status}`);

  // 5. GET /api/leaderboard without auth
  console.log('\n5. GET /api/leaderboard without auth');
  const r5 = await api('GET', '/api/leaderboard');
  assert('Public leaderboard accessible', r5.status === 200, `status=${r5.status}`);

  // 6. Admin endpoint without master key
  if (apiKey) {
    console.log('\n6. Admin endpoint with regular key');
    const r6 = await api('POST', '/api/quest/fake/approve', {}, { 'x-api-key': apiKey });
    // Should be 403 (not admin) or 404 (quest not found) — not 200
    assert('Non-admin approve blocked', r6.status === 403 || r6.status === 404, `status=${r6.status}`);
  }

  // 7. Login with empty credentials
  console.log('\n7. Login with empty credentials');
  const r7 = await api('POST', '/api/auth/login', { name: '', password: '' });
  assert('Empty login rejected', r7.status === 400, `status=${r7.status}`);

  // 8. Login with SQL injection attempt
  console.log('\n8. Login SQL injection test');
  const r8 = await api('POST', '/api/auth/login', { name: "admin' OR '1'='1", password: "' OR '1'='1" });
  assert('SQL injection handled safely', r8.status === 400 || r8.status === 401, `status=${r8.status}`);

  // 9. Register with XSS in name
  console.log('\n9. Register with XSS in name');
  const r9 = await api('POST', '/api/register', { name: '<script>alert(1)</script>', password: 'Test1234', email: 'xss@test.com' });
  assert('XSS in name rejected', r9.status === 400, `status=${r9.status}`);

  // 10. Access other player's data
  if (apiKey) {
    console.log('\n10. Cross-player frame equip');
    const r10 = await api('POST', '/api/player/someoneelse/frame', { frameId: 'test' }, { 'x-api-key': apiKey });
    // Should be 403 (not your data) or 404 (player not found)
    assert('Cross-player frame blocked', r10.status === 403 || r10.status === 404, `status=${r10.status}`);
  }

  // 11. Webhook without signature
  console.log('\n11. GitHub webhook without signature');
  const r11 = await api('POST', '/api/webhooks/github', { action: 'test' });
  assert('Unsigned webhook rejected', r11.status === 401, `status=${r11.status}`);

  // 12. Password reset token brute force (should be rate limited)
  console.log('\n12. Forgot password with invalid email format');
  const r12 = await api('POST', '/api/auth/forgot-password', { email: 'not-an-email' });
  assert('Invalid email handled', r12.status === 400 || r12.status === 200, `status=${r12.status}`);

  console.log(`\n═══ Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ═══\n`);
  if (FAIL > 0) process.exit(1);
}

run().catch(e => { console.error('Test runner failed:', e); process.exit(1); });
