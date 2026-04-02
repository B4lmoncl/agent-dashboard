const router = require('express').Router();
const { state, saveCampaigns, saveUsers, ensureUserCurrencies, rebuildCampaignsById } = require('../lib/state');
const { now, createPlayerLock } = require('../lib/helpers');
const { requireApiKey, requireMasterKey } = require('../lib/middleware');

const campaignClaimLock = createPlayerLock('campaign-claim');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if every non-deleted quest in the campaign is completed. */
function isCampaignFullyCompleted(campaign) {
  if (!campaign.questIds.length) return false;
  return campaign.questIds.every(id => {
    const q = state.questsById.get(id);
    return !q || q.status === 'completed'; // deleted quests count as done
  });
}

// ─── Campaign Endpoints ──────────────────────────────────────────────────────────

// GET /api/campaigns — list all campaigns with enriched quest details
router.get('/api/campaigns', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.users[playerName] : null;
  const claimedSet = new Set(u?.campaignRewardsClaimed || []);

  const enriched = state.campaigns.map(c => {
    const questDetails = c.questIds.map(id => {
      const q = state.questsById.get(id);
      if (!q) return { id, title: '(deleted)', status: 'deleted' };
      return { id: q.id, title: q.title, status: q.status, type: q.type,
               completedBy: q.completedBy, completedAt: q.completedAt, claimedBy: q.claimedBy,
               lore: q.lore || null, description: q.description };
    });
    const completed = questDetails.filter(q => q.status === 'completed').length;
    return {
      ...c,
      quests: questDetails,
      progress: { completed, total: questDetails.length },
      rewardClaimed: claimedSet.has(c.id),
    };
  });
  res.json(enriched);
});

// POST /api/campaigns — create a campaign
router.post('/api/campaigns', requireApiKey, (req, res) => {
  const { title, description, icon, lore, createdBy, questIds, bossQuestId, rewards } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
  const campaign = {
    id: `campaign-${Date.now()}`,
    title: String(title).trim().replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    description: String(description || '').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    icon: icon || null,
    lore: String(lore || '').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    createdBy: createdBy || 'unknown',
    createdAt: now(),
    status: 'active',
    questIds: Array.isArray(questIds) ? questIds.filter(id => state.questsById.has(id)) : [],
    bossQuestId: bossQuestId || null,
    rewards: { xp: Number(rewards?.xp) || 0, gold: Number(rewards?.gold) || 0, title: rewards?.title || '' },
  };
  state.campaigns.push(campaign);
  state.campaignsById.set(campaign.id, campaign);
  saveCampaigns();
  console.log(`[campaigns] Created: ${campaign.id} "${campaign.title}"`);
  res.status(201).json(campaign);
});

// GET /api/campaigns/:id — single campaign with full quest details
router.get('/api/campaigns/:id', (req, res) => {
  const campaign = state.campaignsById.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const questDetails = campaign.questIds.map(id => {
    const q = state.questsById.get(id);
    return q || { id, title: '(deleted)', status: 'deleted' };
  });
  const completed = questDetails.filter(q => q.status === 'completed').length;
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.users[playerName] : null;
  const rewardClaimed = (u?.campaignRewardsClaimed || []).includes(campaign.id);
  res.json({ ...campaign, quests: questDetails, progress: { completed, total: questDetails.length }, rewardClaimed });
});

// PATCH /api/campaigns/:id — update campaign fields
router.patch('/api/campaigns/:id', requireMasterKey, (req, res) => {
  const campaign = state.campaignsById.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { title, description, icon, lore, status, bossQuestId, rewards, questIds } = req.body;
  if (title !== undefined) campaign.title = String(title).trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (description !== undefined) campaign.description = String(description).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (icon !== undefined) campaign.icon = icon;
  if (lore !== undefined) campaign.lore = String(lore).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (status !== undefined && ['active', 'completed', 'archived'].includes(status)) campaign.status = status;
  if (bossQuestId !== undefined) campaign.bossQuestId = bossQuestId || null;
  if (rewards !== undefined) campaign.rewards = { ...campaign.rewards, ...rewards };
  if (questIds !== undefined && Array.isArray(questIds)) campaign.questIds = questIds;
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// DELETE /api/campaigns/:id — delete a campaign
router.delete('/api/campaigns/:id', requireMasterKey, (req, res) => {
  const idx = state.campaigns.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  state.campaigns.splice(idx, 1);
  state.campaignsById.delete(req.params.id);
  saveCampaigns();
  res.json({ ok: true });
});

// POST /api/campaigns/:id/add-quest — add a quest to a campaign
router.post('/api/campaigns/:id/add-quest', requireApiKey, (req, res) => {
  const campaign = state.campaignsById.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId required' });
  if (!state.questsById.has(questId)) return res.status(404).json({ error: 'Quest not found' });
  if (!campaign.questIds.includes(questId)) campaign.questIds.push(questId);
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// POST /api/campaigns/:id/remove-quest — remove a quest from a campaign
router.post('/api/campaigns/:id/remove-quest', requireApiKey, (req, res) => {
  const campaign = state.campaignsById.get(req.params.id);
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

// POST /api/campaigns/:id/claim — claim campaign completion rewards
// Awards gold + XP based on campaign length (50g + 30xp per quest in chain).
// Overrides by campaign.rewards if set explicitly.
router.post('/api/campaigns/:id/claim', requireApiKey, (req, res) => {
  const campaign = state.campaignsById.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const uid = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
  if (!uid) return res.status(401).json({ error: 'Auth required' });

  // Player lock — prevent concurrent double-claims
  if (!campaignClaimLock.acquire(uid)) {
    return res.status(429).json({ error: 'Request already in progress' });
  }

  try {
    const u = state.users[uid];
    if (!u) return res.status(404).json({ error: 'Player not found' });

    // Double-claim guard stored per-user
    u.campaignRewardsClaimed = u.campaignRewardsClaimed || [];
    if (u.campaignRewardsClaimed.includes(campaign.id)) {
      return res.status(409).json({ error: 'Reward already claimed' });
    }

    // All quests must be completed before claiming
    if (!isCampaignFullyCompleted(campaign)) {
      return res.status(400).json({ error: 'Campaign not fully completed yet' });
    }

    // Compute rewards: use explicit campaign.rewards if set, else derive from length
    const questCount = campaign.questIds.length || 1;
    const baseGold = (campaign.rewards?.gold > 0) ? campaign.rewards.gold : questCount * 50;
    const baseXp   = (campaign.rewards?.xp   > 0) ? campaign.rewards.xp   : questCount * 30;
    const titleReward = campaign.rewards?.title || null;

    // Apply rewards
    ensureUserCurrencies(u);
    u.currencies.gold = (u.currencies.gold || 0) + baseGold;
    u.gold = u.currencies.gold;
    u.xp = (u.xp || 0) + baseXp;

    if (titleReward && !u.unlockedTitles?.includes(titleReward)) {
      u.unlockedTitles = u.unlockedTitles || [];
      u.unlockedTitles.push(titleReward);
    }

    // Mark as claimed
    u.campaignRewardsClaimed.push(campaign.id);

    saveUsers();

    const awarded = { gold: baseGold, xp: baseXp, title: titleReward || undefined };
    console.log(`[campaigns] ${uid} claimed reward for campaign ${campaign.id}: +${baseGold}g +${baseXp}xp`);
    res.json({ ok: true, awarded, campaign: { id: campaign.id, title: campaign.title } });
  } finally {
    campaignClaimLock.release(uid);
  }
});

module.exports = router;
