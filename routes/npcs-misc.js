// ─── NPC Quest Giver API, App State, Feedback & SPA Fallback ─────────────────
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, saveNpcState, saveFeedback } = require('../lib/state');
const { getMasterKey, requireMasterKey } = require('../lib/middleware');
const { rotateNpcs } = require('../lib/npc-engine');
const { getPlayerProgress, paginate } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

// GET /api/npcs/active?player=X — overlay per-player NPC quest status
router.get('/api/npcs/active', (req, res) => {
  const now = new Date();
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  // Get per-player NPC quest progress if player is specified
  const playerNpcQuests = playerParam ? (getPlayerProgress(playerParam).npcQuests || {}) : null;

  const result = state.npcState.activeNpcs
    .filter(a => {
      const dep = a.departureTime || a.expiresAt;
      return new Date(dep) > now;
    })
    .map(active => {
      const giver = state.npcGivers.givers.find(g => g.id === active.giverId);
      if (!giver) return null;
      const questIds = state.npcState.npcQuestIds[active.giverId] || [];
      const npcQuests = state.quests.filter(q => questIds.includes(q.id));
      const depTime = active.departureTime || active.expiresAt;
      const msLeft = new Date(depTime) - now;
      return {
        id: giver.id,
        name: giver.name,
        emoji: giver.emoji,
        title: giver.title,
        description: giver.description,
        portrait: giver.portrait || null,
        greeting: giver.greeting || null,
        rarity: giver.rarity || 'common',
        arrivedAt: active.arrivedAt,
        departureTime: depTime,
        expiresAt: active.expiresAt,
        daysLeft: Math.max(0, Math.ceil(msLeft / 86400000)),
        hoursLeft: Math.max(0, Math.ceil(msLeft / 3600000)),
        finalReward: giver.finalReward,
        questChain: questIds.map((qid, idx) => {
          const q = npcQuests.find(x => x.id === qid);
          if (!q) return null;
          // Per-player status overlay
          let status, claimedBy, completedBy;
          if (playerNpcQuests) {
            // Player is logged in: use their per-player progress
            const playerStatus = playerNpcQuests[qid];
            if (playerStatus) {
              status = playerStatus.status;
              claimedBy = playerStatus.status === 'in_progress' ? playerParam : (playerStatus.completedBy || null);
              completedBy = playerStatus.completedBy || null;
            } else {
              // Player hasn't interacted — show as open if chain allows
              if (idx > 0) {
                const prevQid = questIds[idx - 1];
                const prevStatus = playerNpcQuests[prevQid];
                status = (prevStatus && prevStatus.status === 'completed') ? 'open' : 'locked';
              } else {
                status = 'open';
              }
              claimedBy = null;
              completedBy = null;
            }
          } else {
            // No player logged in: show chain-order template status, no personal data
            status = idx === 0 ? 'open' : 'locked';
            claimedBy = null;
            completedBy = null;
          }
          return {
            questId: q.id,
            title: q.title,
            description: q.description,
            type: q.type,
            status,
            claimedBy,
            completedBy,
            rewards: q.npcRewards,
            position: idx + 1,
            flavorText: q.flavorText || null,
          };
        }).filter(Boolean),
      };
    }).filter(Boolean);
  res.json({ npcs: result });
});

// GET /api/npcs/departures — fetch and clear departure notifications (for frontend toasts)
router.get('/api/npcs/departures', (req, res) => {
  const notifications = (state.npcState.departureNotifications || []).slice();
  state.npcState.departureNotifications = [];
  saveNpcState();
  res.json({ departures: notifications });
});

// POST /api/npcs/rotate [admin]
router.post('/api/npcs/rotate', requireMasterKey, (req, res) => {
  rotateNpcs();
  res.json({ ok: true, activeNpcs: state.npcState.activeNpcs });
});

// GET /api/npcs/:id (must be after /departures and /rotate to avoid param capture)
router.get('/api/npcs/:id', (req, res) => {
  const id = req.params.id;
  const giver = state.npcGivers.givers.find(g => g.id === id);
  if (!giver) return res.status(404).json({ error: 'NPC not found' });
  const active = state.npcState.activeNpcs.find(a => a.giverId === id);
  const questIds = state.npcState.npcQuestIds[id] || [];
  const npcQuests = state.quests.filter(q => questIds.includes(q.id));
  res.json({
    ...giver,
    active: !!active,
    arrivedAt: active?.arrivedAt || null,
    departureTime: active?.departureTime || active?.expiresAt || null,
    expiresAt: active?.expiresAt || null,
    cooldownUntil: state.npcState.cooldowns[id] || null,
    quests: npcQuests,
  });
});

// GET /api/app-state
router.get('/api/app-state', (req, res) => {
  res.json({ version: state.appState.version });
});

// ─── Feedback endpoints ────────────────────────────────────────────────────────
// POST /api/feedback — store a feedback entry (capped at 500 entries)
router.post('/api/feedback', (req, res) => {
  const { elementPath, type, text, userId, timestamp } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: 'text too long (max 2000 chars)' });
  }
  if (state.feedbackEntries.length >= 500) {
    return res.status(429).json({ error: 'Feedback limit reached' });
  }
  const entry = {
    id: `fb-${Date.now()}`,
    elementPath: elementPath || 'unknown',
    type: type === 'bug' ? 'bug' : 'feedback',
    text: text.trim().slice(0, 2000).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    userId: 'anonymous', // Always anonymous on unauthed endpoint — don't trust caller-supplied userId
    timestamp: new Date().toISOString(), // Server-set only — don't trust client timestamp
    resolved: false,
  };
  state.feedbackEntries.push(entry);
  saveFeedback();
  console.log(`[feedback] New ${entry.type} from ${entry.userId}: ${entry.elementPath}`);
  res.json({ ok: true, id: entry.id });
});

// GET /api/feedback — list all feedback (admin only, supports pagination)
router.get('/api/feedback', requireMasterKey, (req, res) => {
  if (req.query.limit) {
    const page = paginate(state.feedbackEntries, req.query);
    return res.json({ feedback: page.items, total: page.total, limit: page.limit, offset: page.offset, hasMore: page.hasMore });
  }
  res.json(state.feedbackEntries);
});

// PATCH /api/feedback/:id — resolve/unresolve a feedback entry (admin only)
router.patch('/api/feedback/:id', requireMasterKey, (req, res) => {
  const { id } = req.params;
  const { resolved } = req.body || {};
  
  const entry = state.feedbackEntries.find(e => e.id === id);
  if (!entry) {
    return res.status(404).json({ error: 'Feedback entry not found' });
  }
  
  entry.resolved = !!resolved;
  saveFeedback();
  
  console.log(`[feedback] ${resolved ? 'Resolved' : 'Reopened'} feedback ${id}: ${entry.text.slice(0, 50)}`);
  res.json({ ok: true, entry });
});

// Serve index.html for non-API routes (SPA fallback)
router.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'out', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

module.exports = router;
