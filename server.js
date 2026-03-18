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
  loadItemTemplates,
  saveAppState,
} = require('./lib/state');
const { autoCreateCampaigns, initAchievementCatalogue } = require('./lib/helpers');
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
app.use(require('./routes/npcs-misc'));  // Must be last (has SPA fallback catch-all)

// ─── Boot sequence ───────────────────────────────────────────────────────────
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

// NPC & rotation systems
startupNpcCheck();
setInterval(checkPeriodicTasks, NPC_ROTATION_MS);
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
  setInterval(habitsInventory.fetchAndCacheChangelog, habitsInventory.CHANGELOG_TTL || 30 * 60 * 1000);
}

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
  server.close(() => {
    console.log('[shutdown] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections don't close
  setTimeout(() => { console.warn('[shutdown] Forcing exit'); process.exit(1); }, 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
