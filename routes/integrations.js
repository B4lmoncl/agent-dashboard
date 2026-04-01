const crypto = require('crypto');
const router = require('express').Router();
const { state, saveUsers, saveQuests, saveQuestCatalog } = require('../lib/state');
const { now, todayStr, paginate } = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');
const { rebuildCatalogMeta } = require('../lib/quest-catalog');

// ─── GitHub Webhook ────────────────────────────────────────────────────────────
// Verify GitHub webhook signature (HMAC-SHA256)
function verifyGitHubSignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false; // Fail closed — require secret to be configured
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  // Use raw body bytes for HMAC (re-serializing parsed JSON doesn't match GitHub's signature)
  const body = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// POST /api/webhooks/github — handle GitHub events
// merged PR → create completed quest; new issue → create suggested quest
router.post('/api/webhooks/github', (req, res) => {
  if (!verifyGitHubSignature(req)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
    const pr = payload.pull_request;
    const quest = {
      id: `quest-gh-pr-${pr.number}-${Date.now()}`,
      title: `[PR #${pr.number}] ${String(pr.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`,
      description: pr.body ? String(pr.body).slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;') : `Merged PR by ${pr.user?.login}`,
      priority: 'medium',
      type: 'development',
      categories: ['Coding'],
      status: 'completed',
      createdBy: 'github-bot',
      humanInputRequired: false,
      xp: 0,
      claimedBy: pr.user?.login || null,
      completedBy: pr.user?.login || null,
      completedAt: pr.merged_at || new Date().toISOString(),
      createdAt: pr.created_at || new Date().toISOString(),
    };
    state.quests.push(quest);
    state.questsById.set(quest.id, quest);
    saveQuests();
    console.log(`[github] PR #${pr.number} merged → completed quest ${quest.id}`);
    return res.json({ ok: true, event: 'pr_merged', questId: quest.id });
  }

  if (event === 'issues' && payload.action === 'opened') {
    const issue = payload.issue;
    const quest = {
      id: `quest-gh-issue-${issue.number}-${Date.now()}`,
      title: `[Issue #${issue.number}] ${String(issue.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`,
      description: issue.body ? String(issue.body).slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;') : `GitHub issue opened by ${issue.user?.login}`,
      priority: 'medium',
      type: 'development',
      categories: ['Bug Fix'],
      status: 'suggested',
      createdBy: 'github-bot',
      humanInputRequired: true,
      xp: 0,
      claimedBy: null,
      completedBy: null,
      completedAt: null,
      createdAt: issue.created_at || new Date().toISOString(),
    };
    state.quests.push(quest);
    state.questsById.set(quest.id, quest);
    saveQuests();
    console.log(`[github] Issue #${issue.number} opened → suggested quest ${quest.id}`);
    return res.json({ ok: true, event: 'issue_opened', questId: quest.id });
  }

  res.json({ ok: true, event, action: payload.action || null, ignored: true });
});

// ─── Spotify Integration (placeholders) ────────────────────────────────────────
// POST /api/integrations/spotify/connect
router.post('/api/integrations/spotify/connect', requireApiKey, (req, res) => {
  const { userId, accessToken, refreshToken } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'User not found' });
  u.spotify = { connected: true, connectedAt: new Date().toISOString(), accessToken: accessToken || null, refreshToken: refreshToken || null };
  saveUsers();
  console.log(`[spotify] user ${userId} connected`);
  res.json({ ok: true, message: 'Spotify connected (placeholder)' });
});

// GET /api/integrations/spotify/status
router.get('/api/integrations/spotify/status', requireApiKey, (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true, connected: !!u.spotify?.connected, connectedAt: u.spotify?.connectedAt || null });
});

// POST /api/events/quest-start
router.post('/api/events/quest-start', requireApiKey, (req, res) => {
  const { questId, userId } = req.body || {};
  console.log(`[event] quest-start questId=${questId} userId=${userId}`);
  // Placeholder: trigger Spotify playlist, notifications, etc.
  res.json({ ok: true, event: 'quest-start', questId, userId });
});

// POST /api/events/quest-complete
router.post('/api/events/quest-complete', requireApiKey, (req, res) => {
  const { questId, userId } = req.body || {};
  console.log(`[event] quest-complete questId=${questId} userId=${userId}`);
  // Placeholder: trigger Spotify celebration track, etc.
  res.json({ ok: true, event: 'quest-complete', questId, userId });
});

// POST /api/events/level-up
router.post('/api/events/level-up', requireApiKey, (req, res) => {
  const { userId, newLevel } = req.body || {};
  console.log(`[event] level-up userId=${userId} newLevel=${newLevel}`);
  // Placeholder: trigger Spotify level-up fanfare, etc.
  res.json({ ok: true, event: 'level-up', userId, newLevel });
});

// POST /api/forge/temp-decay — decay forgeTemp for users who missed recurring quests
// Call this from a cron or trigger manually
router.post('/api/forge/temp-decay', requireApiKey, (req, res) => {
  const { calcDynamicForgeTemp } = require('../lib/helpers');
  const today = todayStr();
  let decayed = 0;
  for (const [uid, u] of Object.entries(state.users)) {
    if (!u.streakLastDate || u.streakLastDate === today) continue;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (u.streakLastDate !== yesterday) {
      // missed at least one day — use calcDynamicForgeTemp (includes talent + legendary + stats)
      // then apply the -10 miss penalty
      const currentTemp = calcDynamicForgeTemp(uid);
      u.forgeTemp = Math.max(0, currentTemp - 10);
      u.forgeTempAt = new Date().toISOString();
      decayed++;
    }
  }
  if (decayed > 0) saveUsers();
  res.json({ ok: true, decayed });
});

// ─── Quest Catalog API ────────────────────────────────────────────────────────

// GET /api/catalog — full catalog with meta (supports pagination on templates)
router.get('/api/catalog', (req, res) => {
  rebuildCatalogMeta();
  if (req.query.limit && state.questCatalog.templates) {
    const page = paginate(state.questCatalog.templates, req.query);
    return res.json({ ...state.questCatalog, templates: page.items, total: page.total, limit: page.limit, offset: page.offset, hasMore: page.hasMore });
  }
  res.json(state.questCatalog);
});

// GET /api/catalog/stats — just meta stats
router.get('/api/catalog/stats', (req, res) => {
  rebuildCatalogMeta();
  res.json(state.questCatalog.meta);
});

// POST /api/catalog/template — add new template [auth]
router.post('/api/catalog/template', requireApiKey, (req, res) => {
  const { title, description, type, category, classId, minLevel, chainId, chainOrder, difficulty, estimatedTime, rewards, tags, createdBy } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validCategories = ['generic', 'classQuest', 'chainQuest', 'companionQuest'];
  const validDifficulties = ['starter', 'intermediate', 'advanced', 'expert'];
  const tpl = {
    id: `tpl-${Date.now()}`,
    title,
    description: description || '',
    type: type || 'development',
    category: validCategories.includes(category) ? category : 'generic',
    classId: classId || null,
    minLevel: typeof minLevel === 'number' ? minLevel : 1,
    chainId: chainId || null,
    chainOrder: typeof chainOrder === 'number' ? chainOrder : null,
    difficulty: validDifficulties.includes(difficulty) ? difficulty : 'starter',
    estimatedTime: estimatedTime || null,
    rewards: rewards || { xp: 0, gold: 0 },
    tags: Array.isArray(tags) ? tags : [],
    createdBy: createdBy || 'unknown',
    createdAt: now(),
  };
  state.questCatalog.templates.push(tpl);
  if (tpl.id) state.questCatalogById.set(tpl.id, tpl);
  rebuildCatalogMeta();
  saveQuestCatalog();
  res.json({ ok: true, template: tpl });
});

module.exports = router;
