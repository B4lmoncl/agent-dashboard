/**
 * Agent Dashboard - REST API Server (slim entry point)
 * Run: node server.js
 * Serves: http://localhost:3001
 *
 * All route handlers are in /routes/*.js
 * Shared state & helpers are in /lib/*.js
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

// ─── Shared modules ──────────────────────────────────────────────────────────
const {
  state, AGENT_NAMES, NPC_ROTATION_MS,
  ensureDataDir, ensureRuntimeDir, ensureRuntimeFiles, seedMutableFiles, ensureTemplateFiles,
  initStore, loadData, loadQuests, loadCampaigns, loadManagedKeys,
  loadUsers, loadPlayerProgress, loadQuestCatalog, loadClasses,
  loadCompanionsData, loadRoadmap, loadRituals, loadHabits,
  loadLootTables, loadGearTemplates, loadNpcGivers, loadNpcState,
  loadAppState, loadFeedback,
  loadCurrencyTemplates, loadGachaPool, loadBannerTemplates, loadGachaState,
  loadItemTemplates, loadTitles, loadUniqueItems,
  loadSocialData,
  saveAppState,
  flushPendingSaves,
} = require('./lib/state');
const { autoCreateCampaigns, initAchievementCatalogue, migrateUserEquipment } = require('./lib/helpers');
const { startupNpcCheck, checkPeriodicTasks } = require('./lib/npc-engine');
const { checkAndRunDailyRotation } = require('./lib/rotation');
const { seedQuestCatalog } = require('./lib/quest-catalog');

// ─── Express setup ───────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3001;

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.set('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too Many Requests', retryAfter });
  },
});
app.use(limiter);

// Mutation rate limiter — 60 writes per minute per IP (POST/PATCH/PUT/DELETE only)
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many mutations — please slow down', retryAfter: 60 },
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
});
app.use('/api/', mutationLimiter);

// Static files
// Static files with caching headers
app.use('/_next/static', express.static(path.join(__dirname, 'out', '_next', 'static'), {
  maxAge: '1y', etag: true,
}));
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), {
  maxAge: '1h', etag: true,
}));
app.use(express.static(path.join(__dirname, 'out'), { maxAge: '1h' }));
app.use('/data', express.static(path.join(__dirname, 'public', 'data')));

// ─── API Key initialization ──────────────────────────────────────────────────
const validApiKeys = new Set(
  [
    ...(process.env.API_KEYS ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : []),
    ...(process.env.API_KEY ? [process.env.API_KEY.trim()] : []),
  ]
);
if (validApiKeys.size === 0) {
  console.error('[fatal] No API keys configured. Set API_KEY or API_KEYS environment variable. Exiting.');
  process.exit(1);
}
// Inject into shared state so middleware and routes can access it
state.validApiKeys = validApiKeys;

// ─── Mount route files ───────────────────────────────────────────────────────
app.use(require('./routes/agents'));
app.use(require('./routes/quests'));
app.use(require('./routes/config-admin'));
app.use(require('./routes/docs'));
app.use(require('./routes/campaigns'));
app.use(require('./routes/users'));
app.use(require('./routes/players'));
app.use(require('./routes/shop'));
app.use(require('./routes/currency'));
app.use(require('./routes/gacha'));
app.use(require('./routes/integrations'));
app.use(require('./routes/game'));
app.use(require('./routes/habits-inventory'));
app.use(require('./routes/crafting'));
app.use(require('./routes/schmiedekunst'));
app.use(require('./routes/enchanting'));
app.use(require('./routes/challenges-weekly'));
app.use(require('./routes/expedition'));
app.use(require('./routes/social'));
app.use(require('./routes/rift'));
app.use('/api/factions', require('./routes/factions'));
app.use('/api/battlepass', require('./routes/battlepass'));
app.use(require('./routes/world-boss'));
app.use(require('./routes/gems'));
app.use(require('./routes/dungeons'));
app.use(require('./routes/kanais-cube'));
app.use(require('./routes/mail'));
app.use(require('./routes/codex'));
app.use(require('./routes/talent-tree'));
app.use(require('./routes/adventure-tome'));
app.use(require('./routes/npcs-misc'));  // Must be last (has SPA fallback catch-all)

// ─── Express error handler (catch-all for unhandled route errors) ────────────
app.use((err, req, res, _next) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Boot sequence ───────────────────────────────────────────────────────────
// Verify data directory is writable — critical for player progress persistence
const { RUNTIME_DIR } = require('./lib/state');
try {
  const testFile = path.join(RUNTIME_DIR, '.write-test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
  console.log(`[boot] Data directory ${RUNTIME_DIR} is writable`);
} catch (e) {
  console.error(`\n${'='.repeat(70)}`);
  console.error(`  CRITICAL: Data directory ${RUNTIME_DIR} is NOT writable!`);
  console.error(`  Player progress will NOT be saved.`);
  console.error(`  Error: ${e.message}`);
  console.error(`  Fix: run 'chown -R appuser:appgroup ${RUNTIME_DIR}' or check Docker volume permissions`);
  console.error(`${'='.repeat(70)}\n`);
}
ensureDataDir();
ensureRuntimeFiles();
seedMutableFiles();
ensureTemplateFiles();
initStore();
loadData();
loadQuests();
loadCampaigns();
autoCreateCampaigns();
loadManagedKeys();

// Add managed keys to validApiKeys
for (const k of state.managedKeys) {
  validApiKeys.add(k.key);
}

loadUsers();
loadPlayerProgress();
loadQuestCatalog();
seedQuestCatalog();
loadClasses();
loadCompanionsData();
loadRoadmap();
loadRituals();
loadHabits();
loadLootTables();
loadGearTemplates();
loadNpcGivers();
loadNpcState();
loadAppState();
loadFeedback();
initAchievementCatalogue();
loadCurrencyTemplates();
loadGachaPool();
loadBannerTemplates();
loadGachaState();
loadItemTemplates();
loadTitles();
loadUniqueItems();
loadSocialData();
require('./routes/crafting').loadProfessions();
require('./routes/challenges-weekly').loadWeeklyChallenges();
require('./routes/expedition').loadExpeditions();
require('./routes/expedition').loadExpeditionState();
require('./routes/world-boss').loadWorldBossState();
require('./routes/world-boss').checkAutoSpawn();
require('./routes/gems').loadGems();
require('./routes/players').loadCompanionExpeditions();
require('./routes/dungeons').loadDungeonTemplates();
require('./routes/dungeons').loadDungeonState();
require('./routes/codex').loadCodex();

// Migrate legacy equipment (string IDs → rolled instances) — only if needed
{
  const needsMigration = Object.values(state.users).some(u =>
    u.equipment && Object.values(u.equipment).some(v => typeof v === 'string')
  );
  if (needsMigration) {
    for (const uid of Object.keys(state.users)) migrateUserEquipment(uid);
    console.log('[migration] Equipment migration complete');
  }
}

// Migrate inventory items: backfill missing slot/icon from gear templates
(() => {
  let migrated = 0;
  for (const u of Object.values(state.users)) {
    if (!u.inventory || !Array.isArray(u.inventory)) continue;
    for (const item of u.inventory) {
      if (!item || typeof item === 'string') continue;
      const tid = item.templateId || item.itemId;
      if (!tid) continue;
      const tmpl = state.gearById.get(tid) || state.itemTemplates?.get(tid);
      if (!tmpl) continue;
      if (!item.slot && tmpl.slot) { item.slot = tmpl.slot; migrated++; }
      if (!item.icon && tmpl.icon) { item.icon = tmpl.icon; }
      if (!item.rarity && tmpl.rarity) { item.rarity = tmpl.rarity; }
    }
  }
  if (migrated > 0) {
    const { saveUsers } = require('./lib/state');
    saveUsers();
    console.log(`[migration] Backfilled slot/icon/rarity on ${migrated} inventory items`);
  }
})();

// NPC & rotation systems
startupNpcCheck();
const npcInterval = setInterval(checkPeriodicTasks, NPC_ROTATION_MS);
checkAndRunDailyRotation();

// Version tracking
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  if (pkg.version) {
    state.appState.version = pkg.version;
    saveAppState();
  }
} catch (e) { /* ignore */ }

// Changelog auto-refresh
const habitsInventory = require('./routes/habits-inventory');
if (habitsInventory.fetchAndCacheChangelog) {
  habitsInventory.fetchAndCacheChangelog();
  var changelogInterval = setInterval(habitsInventory.fetchAndCacheChangelog, habitsInventory.CHANGELOG_TTL || 30 * 60 * 1000);
}

// ─── Memory pruning ────────────────────────────────────────────────────────
// Clean up unbounded in-memory data every hour
function pruneMemory() {
  // Prune todayCompletions — keep only entries from today
  const today = new Date().toISOString().slice(0, 10);
  for (const [userId, data] of Object.entries(state.todayCompletions)) {
    if (data && data.date && data.date !== today) {
      delete state.todayCompletions[userId];
    }
  }
  // Prune departureNotifications — keep max 50 most recent
  if (state.npcState.departureNotifications && state.npcState.departureNotifications.length > 50) {
    state.npcState.departureNotifications = state.npcState.departureNotifications.slice(-50);
  }
}
pruneMemory(); // Run once at boot
const pruneInterval = setInterval(pruneMemory, 60 * 60 * 1000); // Then every hour

// ─── Periodic force-save (safety net for player progress) ───────────────────
// Flush all pending saves every 60s to ensure data survives unexpected restarts
const forceSaveInterval = setInterval(() => {
  flushPendingSaves();
}, 60 * 1000);

// ─── Start server ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🔴 Agent Dashboard API running on http://localhost:${PORT}`);
  console.log(`   Agents: ${AGENT_NAMES.join(', ')}`);
  console.log(`   API Keys: ${validApiKeys.size} configured`);
  console.log(`   Rate limit: 2000 req / 15 min per IP\n`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[shutdown] ${signal} received, closing server...`);
  // Clear all intervals so they don't block server.close()
  clearInterval(npcInterval);
  clearInterval(pruneInterval);
  clearInterval(forceSaveInterval);
  if (typeof changelogInterval !== 'undefined') clearInterval(changelogInterval);
  flushPendingSaves();
  server.close(() => {
    console.log('[shutdown] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections don't close
  setTimeout(() => { console.warn('[shutdown] Forcing exit'); process.exit(1); }, 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Global error handlers — prevent data loss on unhandled errors ────────
process.on('unhandledRejection', (reason) => {
  console.error('[error] Unhandled promise rejection:', reason);
  flushPendingSaves();
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err);
  flushPendingSaves();
  process.exit(1);
});
