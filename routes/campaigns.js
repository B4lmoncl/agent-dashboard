const router = require('express').Router();
const { state, saveCampaigns } = require('../lib/state');
const { now } = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');

// ─── Campaign Endpoints ──────────────────────────────────────────────────────────

// GET /api/campaigns — list all campaigns with enriched quest details
router.get('/api/campaigns', (req, res) => {
  const enriched = state.campaigns.map(c => {
    const questDetails = c.questIds.map(id => {
      const q = state.quests.find(q => q.id === id);
      if (!q) return { id, title: '(deleted)', status: 'deleted' };
      return { id: q.id, title: q.title, status: q.status, priority: q.priority, type: q.type,
               completedBy: q.completedBy, completedAt: q.completedAt, claimedBy: q.claimedBy,
               lore: q.lore || null, description: q.description };
    });
    const completed = questDetails.filter(q => q.status === 'completed').length;
    return { ...c, quests: questDetails, progress: { completed, total: questDetails.length } };
  });
  res.json(enriched);
});

// POST /api/campaigns — create a campaign
router.post('/api/campaigns', requireApiKey, (req, res) => {
  const { title, description, icon, lore, createdBy, questIds, bossQuestId, rewards } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
  const campaign = {
    id: `campaign-${Date.now()}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    icon: icon || 'xx',
    lore: String(lore || '').trim(),
    createdBy: createdBy || 'unknown',
    createdAt: now(),
    status: 'active',
    questIds: Array.isArray(questIds) ? questIds.filter(id => state.quests.find(q => q.id === id)) : [],
    bossQuestId: bossQuestId || null,
    rewards: { xp: Number(rewards?.xp) || 0, gold: Number(rewards?.gold) || 0, title: rewards?.title || '' },
  };
  state.campaigns.push(campaign);
  saveCampaigns();
  console.log(`[campaigns] Created: ${campaign.id} "${campaign.title}"`);
  res.status(201).json(campaign);
});

// GET /api/campaigns/:id — single campaign with full quest details
router.get('/api/campaigns/:id', (req, res) => {
  const campaign = state.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const questDetails = campaign.questIds.map(id => {
    const q = state.quests.find(q => q.id === id);
    return q || { id, title: '(deleted)', status: 'deleted' };
  });
  const completed = questDetails.filter(q => q.status === 'completed').length;
  res.json({ ...campaign, quests: questDetails, progress: { completed, total: questDetails.length } });
});

// PATCH /api/campaigns/:id — update campaign fields
router.patch('/api/campaigns/:id', requireApiKey, (req, res) => {
  const campaign = state.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { title, description, icon, lore, status, bossQuestId, rewards, questIds } = req.body;
  if (title !== undefined) campaign.title = String(title).trim();
  if (description !== undefined) campaign.description = String(description);
  if (icon !== undefined) campaign.icon = icon;
  if (lore !== undefined) campaign.lore = String(lore);
  if (status !== undefined && ['active', 'completed', 'archived'].includes(status)) campaign.status = status;
  if (bossQuestId !== undefined) campaign.bossQuestId = bossQuestId || null;
  if (rewards !== undefined) campaign.rewards = { ...campaign.rewards, ...rewards };
  if (questIds !== undefined && Array.isArray(questIds)) campaign.questIds = questIds;
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// DELETE /api/campaigns/:id — delete a campaign
router.delete('/api/campaigns/:id', requireApiKey, (req, res) => {
  const idx = state.campaigns.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  state.campaigns.splice(idx, 1);
  saveCampaigns();
  res.json({ ok: true });
});

// POST /api/campaigns/:id/add-quest — add a quest to a campaign
router.post('/api/campaigns/:id/add-quest', requireApiKey, (req, res) => {
  const campaign = state.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId required' });
  if (!state.quests.find(q => q.id === questId)) return res.status(404).json({ error: 'Quest not found' });
  if (!campaign.questIds.includes(questId)) campaign.questIds.push(questId);
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// POST /api/campaigns/:id/remove-quest — remove a quest from a campaign
router.post('/api/campaigns/:id/remove-quest', requireApiKey, (req, res) => {
  const campaign = state.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId required' });
  campaign.questIds = campaign.questIds.filter(id => id !== questId);
  if (campaign.bossQuestId === questId) campaign.bossQuestId = null;
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// GET /api/agent/:name/quests — get agent's active quests
router.get('/api/agent/:name/quests', (req, res) => {
  const name = req.params.name.toLowerCase();
  const active = state.quests.filter(q => q.claimedBy === name && q.status === 'in_progress');
  res.json(active);
});

module.exports = router;
