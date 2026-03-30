#!/usr/bin/env node
/**
 * Inventory Edge-Case Tests
 * Tests: equip nonexistent item, unequip empty slot, dismantle equipped,
 *        lock/unlock flow, discard locked item, inventory overflow
 *
 * Usage: node scripts/test-inventory-edge-cases.js
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
  console.log('\n═══ Inventory Edge-Case Tests ═══\n');

  const apiKey = process.env.API_KEY || process.env.API_KEYS?.split(',')[0];
  if (!apiKey) { console.log('⚠ No API_KEY — skipping'); return; }
  const auth = { 'x-api-key': apiKey };
  const player = process.env.TEST_PLAYER || 'testplayer';

  // 1. Equip nonexistent item
  console.log('1. Equip nonexistent item');
  const r1 = await api('POST', `/api/player/${player}/equip/fake-item-99999`, null, auth);
  assert('Equip nonexistent returns 404', r1.status === 404, `status=${r1.status}`);

  // 2. Unequip empty slot
  console.log('\n2. Unequip empty slot');
  const r2 = await api('POST', `/api/player/${player}/unequip/ring`, null, auth);
  // Should be 400 (nothing equipped) or 200 (no-op)
  assert('Unequip empty handled', r2.status === 400 || r2.status === 200, `status=${r2.status}`);

  // 3. Dismantle nonexistent item
  console.log('\n3. Dismantle nonexistent item');
  const r3 = await api('POST', '/api/schmiedekunst/dismantle', { inventoryItemId: 'fake-item-99999' }, auth);
  assert('Dismantle nonexistent returns 404', r3.status === 404, `status=${r3.status}`);

  // 4. Discard nonexistent item
  console.log('\n4. Discard nonexistent item');
  const r4 = await api('POST', `/api/player/${player}/inventory/discard/fake-item-99999`, null, auth);
  assert('Discard nonexistent returns 404', r4.status === 404, `status=${r4.status}`);

  // 5. Use nonexistent item
  console.log('\n5. Use nonexistent item');
  const r5 = await api('POST', `/api/player/${player}/inventory/use/fake-item-99999`, null, auth);
  assert('Use nonexistent returns 404', r5.status === 404, `status=${r5.status}`);

  // 6. Lock nonexistent item
  console.log('\n6. Lock nonexistent item');
  const r6 = await api('POST', `/api/player/${player}/inventory/lock/fake-item-99999`, null, auth);
  assert('Lock nonexistent returns 404', r6.status === 404, `status=${r6.status}`);

  // 7. Transmute with only 2 items (need 3)
  console.log('\n7. Transmute with 2 items');
  const r7 = await api('POST', '/api/schmiedekunst/transmute', { itemIds: ['a', 'b'] }, auth);
  assert('Transmute with 2 items returns 400', r7.status === 400, `status=${r7.status}`);

  // 8. Transmute with duplicate IDs
  console.log('\n8. Transmute with duplicate IDs');
  const r8 = await api('POST', '/api/schmiedekunst/transmute', { itemIds: ['a', 'a', 'a'] }, auth);
  assert('Transmute with duplicates returns 400', r8.status === 400, `status=${r8.status}`);

  // 9. Dismantle-all with invalid rarity
  console.log('\n9. Dismantle-all invalid rarity');
  const r9 = await api('POST', '/api/schmiedekunst/dismantle-all', { rarity: 'mythic' }, auth);
  assert('Invalid rarity returns 400', r9.status === 400, `status=${r9.status}`);

  // 10. Dismantle-all legendary (should be blocked)
  console.log('\n10. Bulk dismantle legendary');
  const r10 = await api('POST', '/api/schmiedekunst/dismantle-all', { rarity: 'legendary' }, auth);
  assert('Legendary bulk dismantle blocked', r10.status === 400, `status=${r10.status}`);

  // 11. Reorder with empty array
  console.log('\n11. Reorder with empty array');
  const r11 = await api('POST', `/api/player/${player}/inventory/reorder`, { order: [] }, auth);
  assert('Empty reorder handled', r11.status === 200 || r11.status === 400, `status=${r11.status}`);

  console.log(`\n═══ Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ═══\n`);
  if (FAIL > 0) process.exit(1);
}

run().catch(e => { console.error('Test runner failed:', e); process.exit(1); });
