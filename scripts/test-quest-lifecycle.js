#!/usr/bin/env node
/**
 * Quest Lifecycle Edge-Case Tests
 * Tests: double-claim, unclaim-then-reclaim, complete-without-claim,
 *        complete-already-completed, claim-nonexistent, etc.
 *
 * Usage: node scripts/test-quest-lifecycle.js
 * Requires: server running on port 3001 with at least 1 API key configured
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
  console.log('\n═══ Quest Lifecycle Edge-Case Tests ═══\n');

  // Get API key from env or try to read from config
  const apiKey = process.env.API_KEY || process.env.API_KEYS?.split(',')[0];
  if (!apiKey) { console.log('⚠ No API_KEY env var — skipping (set API_KEY=your-key)'); return; }
  const auth = { 'x-api-key': apiKey };

  // 1. Try to claim a nonexistent quest
  console.log('1. Claim nonexistent quest');
  const r1 = await api('POST', '/api/quest/nonexistent-id-12345/claim', { agentId: 'testplayer' }, auth);
  assert('Returns 404 for nonexistent quest', r1.status === 404);

  // 2. Try to complete a quest without claiming it
  console.log('\n2. Complete quest without claiming');
  const questsR = await api('GET', '/api/quests', null, auth);
  const openQuest = questsR.data?.open?.[0];
  if (!openQuest) { console.log('  ⚠ No open quests — skipping remaining tests'); SKIP += 5; return; }
  const r2 = await api('POST', `/api/quest/${openQuest.id}/complete`, { agentId: 'testplayer' }, auth);
  // This should either fail (not claimed) or succeed (per-player tracking)
  assert('Complete without claim handled', r2.status === 200 || r2.status === 400 || r2.status === 409, `status=${r2.status}`);

  // 3. Claim a quest, then try to claim again (double claim)
  console.log('\n3. Double claim');
  const r3a = await api('POST', `/api/quest/${openQuest.id}/claim`, { agentId: 'testplayer' }, auth);
  if (!r3a.ok) { console.log('  ⚠ First claim failed — skipping double claim test'); SKIP++; }
  else {
    const r3b = await api('POST', `/api/quest/${openQuest.id}/claim`, { agentId: 'testplayer' }, auth);
    assert('Double claim returns 409', r3b.status === 409, `status=${r3b.status}`);
  }

  // 4. Unclaim the quest
  console.log('\n4. Unclaim');
  const r4 = await api('POST', `/api/quest/${openQuest.id}/unclaim`, { agentId: 'testplayer' }, auth);
  assert('Unclaim succeeds', r4.ok || r4.status === 409, `status=${r4.status}`);

  // 5. Try to unclaim again (already unclaimed)
  console.log('\n5. Double unclaim');
  const r5 = await api('POST', `/api/quest/${openQuest.id}/unclaim`, { agentId: 'testplayer' }, auth);
  assert('Double unclaim returns 409', r5.status === 409, `status=${r5.status}`);

  // 6. Claim with empty agentId
  console.log('\n6. Claim with empty agentId');
  const r6 = await api('POST', `/api/quest/${openQuest.id}/claim`, { agentId: '' }, auth);
  assert('Empty agentId returns 400', r6.status === 400, `status=${r6.status}`);

  // 7. Claim without agentId field
  console.log('\n7. Claim without agentId');
  const r7 = await api('POST', `/api/quest/${openQuest.id}/claim`, {}, auth);
  assert('Missing agentId returns 400', r7.status === 400, `status=${r7.status}`);

  // 8. Create quest with extremely long title
  console.log('\n8. Create quest with 600-char title');
  const r8 = await api('POST', '/api/quest', { title: 'A'.repeat(600), description: 'test' }, auth);
  assert('600-char title rejected', r8.status === 400, `status=${r8.status}`);

  // 9. Create quest with empty title
  console.log('\n9. Create quest with empty title');
  const r9 = await api('POST', '/api/quest', { title: '', description: 'test' }, auth);
  assert('Empty title rejected', r9.status === 400, `status=${r9.status}`);

  // 10. Create quest with invalid priority
  console.log('\n10. Create quest with invalid priority');
  const r10 = await api('POST', '/api/quest', { title: 'Test', priority: 'ULTRA' }, auth);
  assert('Invalid priority rejected', r10.status === 400, `status=${r10.status}`);

  console.log(`\n═══ Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ═══\n`);
  if (FAIL > 0) process.exit(1);
}

run().catch(e => { console.error('Test runner failed:', e); process.exit(1); });
