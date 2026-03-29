/**
 * Mail System — WoW-style async item/gold delivery.
 * Players can send mail with gold and/or items to any other player.
 * Mail expires after 30 days. Attachments must be collected.
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, INVENTORY_CAP, createPlayerLock } = require('../lib/helpers');
const mailSendLock = createPlayerLock('mail-send');
const mailCollectLock = createPlayerLock('mail-collect');
const { requireAuth } = require('../lib/middleware');

const MAIL_LIMIT = 50; // Max mails in inbox
const MAIL_EXPIRY_DAYS = 30;
const SEND_COST = 5; // 5 gold per mail (gold sink)

function ensureMailbox(u) {
  if (!u.mailbox) u.mailbox = [];
  return u.mailbox;
}

function getEquippedIds(u) {
  const ids = new Set();
  for (const val of Object.values(u.equipment || {})) {
    if (val && typeof val === 'object') {
      if (val.instanceId) ids.add(val.instanceId);
      if (val.id) ids.add(val.id);
    }
  }
  return ids;
}

// ─── GET /api/mail — Fetch inbox ─────────────────────────────────────────────

router.get('/api/mail', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const mailbox = ensureMailbox(u);

  // Prune expired mail (auto-return attachments would need sender lookup — skip for now)
  const cutoff = Date.now() - MAIL_EXPIRY_DAYS * 24 * 3600000;
  const before = mailbox.length;
  u.mailbox = mailbox.filter(m => new Date(m.sentAt).getTime() > cutoff);
  if (u.mailbox.length < before) saveUsers();

  res.json({
    inbox: u.mailbox.map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      body: m.body || '',
      gold: m.gold || 0,
      items: (m.items || []).map(i => ({
        id: i.id || i.instanceId,
        name: i.name,
        rarity: i.rarity || 'common',
        icon: i.icon || null,
        slot: i.slot || null,
      })),
      sentAt: m.sentAt,
      read: m.read || false,
      collected: m.collected || false,
    })),
    count: u.mailbox.length,
    limit: MAIL_LIMIT,
  });
});

// ─── POST /api/mail/send — Send mail to another player ───────────────────────

router.post('/api/mail/send', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!mailSendLock.acquire(uid)) return res.status(429).json({ error: 'Mail send in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { to, subject, body, gold, items: itemIds } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient required' });
  if (!subject || typeof subject !== 'string' || subject.length > 100) {
    return res.status(400).json({ error: 'Subject required (max 100 chars)' });
  }

  const recipientId = to.toLowerCase();
  if (recipientId === uid) return res.status(400).json({ error: 'Cannot mail yourself' });
  const recipient = state.users[recipientId];
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  // Check recipient mailbox capacity
  const recipientMailbox = ensureMailbox(recipient);
  if (recipientMailbox.length >= MAIL_LIMIT) {
    return res.status(400).json({ error: 'Recipient mailbox is full' });
  }

  // Validate gold
  const goldAmount = Math.max(0, parseInt(gold, 10) || 0);
  ensureUserCurrencies(u);
  const totalGoldNeeded = goldAmount + SEND_COST;
  if ((u.currencies.gold || 0) < totalGoldNeeded) {
    return res.status(400).json({ error: `Not enough gold. Need ${totalGoldNeeded} (${goldAmount} + ${SEND_COST} postage), you have ${u.currencies.gold || 0}.` });
  }

  // Validate items
  const attachedItems = [];
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    if (itemIds.length > 6) return res.status(400).json({ error: 'Max 6 items per mail' });
    const equippedIds = getEquippedIds(u);
    const inv = u.inventory || [];
    for (const itemId of itemIds) {
      const item = inv.find(i => (i.instanceId || i.id) === itemId);
      if (!item) return res.status(400).json({ error: `Item not found in your inventory` });
      if (equippedIds.has(itemId)) return res.status(400).json({ error: `${item.name || 'Item'} is currently equipped — unequip it first` });
      if (item.binding === 'bop' || item.bound) {
        return res.status(400).json({ error: `${item.name || 'Item'} is soulbound and cannot be sent` });
      }
      if (item.locked) return res.status(400).json({ error: `${item.name || 'Item'} is locked — unlock it first to send` });
      attachedItems.push(item);
    }
  }

  // Deduct gold (amount + postage)
  u.currencies.gold -= totalGoldNeeded;
  u.gold = u.currencies.gold;

  // Remove items from sender inventory
  if (attachedItems.length > 0) {
    const removeIds = new Set(attachedItems.map(i => i.instanceId || i.id));
    u.inventory = (u.inventory || []).filter(i => !removeIds.has(i.instanceId || i.id));
  }

  // Create mail
  const mail = {
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from: u.name || uid,
    to: recipientId,
    subject,
    body: (body || '').slice(0, 500),
    gold: goldAmount,
    items: attachedItems,
    sentAt: now(),
    read: false,
    collected: false,
  };

  recipientMailbox.push(mail);
  saveUsers();

  res.json({
    ok: true,
    message: `Mail sent to ${recipient.name || recipientId}`,
    mailId: mail.id,
    goldDeducted: totalGoldNeeded,
    itemsSent: attachedItems.length,
  });
  } finally { mailSendLock.release(uid); }
});

// ─── POST /api/mail/:mailId/collect — Collect attachments from mail ──────────

router.post('/api/mail/:mailId/collect', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!mailCollectLock.acquire(uid)) return res.status(429).json({ error: 'Collect in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const mailbox = ensureMailbox(u);
  const mail = mailbox.find(m => m.id === req.params.mailId);
  if (!mail) return res.status(404).json({ error: 'Mail not found' });
  if (mail.collected) return res.status(400).json({ error: 'Already collected' });

  // Validate inventory space BEFORE awarding anything
  u.inventory = u.inventory || [];
  const mailItems = mail.items || [];
  if (mailItems.length > 0 && u.inventory.length + mailItems.length > INVENTORY_CAP) {
    return res.status(400).json({ error: `Not enough inventory space (need ${mailItems.length} slots, have ${INVENTORY_CAP - u.inventory.length})` });
  }

  // Collect gold (safe — inventory check passed)
  ensureUserCurrencies(u);
  if (mail.gold > 0) {
    u.currencies.gold = (u.currencies.gold || 0) + mail.gold;
    u.gold = u.currencies.gold;
  }

  // Collect items
  const collectedItems = [];
  for (const item of mailItems) {
    u.inventory.push(item);
    collectedItems.push(item.name || item.id);
  }

  mail.collected = true;
  mail.read = true;
  saveUsers();

  res.json({
    ok: true,
    goldCollected: mail.gold || 0,
    itemsCollected: collectedItems,
    message: `Collected${mail.gold ? ` ${mail.gold} gold` : ''}${collectedItems.length ? ` + ${collectedItems.length} items` : ''}`,
  });
  } finally { mailCollectLock.release(uid); }
});

// ─── POST /api/mail/collect-all — Collect all uncollected mail attachments ────

router.post('/api/mail/collect-all', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!mailCollectLock.acquire(uid)) return res.status(429).json({ error: 'Collect in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const mailbox = ensureMailbox(u);
  const uncollected = mailbox.filter(m => !m.collected && ((m.gold || 0) > 0 || (m.items || []).length > 0));
  if (uncollected.length === 0) return res.status(400).json({ error: 'Nothing to collect' });

  // Check total inventory space needed
  u.inventory = u.inventory || [];
  const totalItems = uncollected.reduce((sum, m) => sum + (m.items || []).length, 0);
  if (totalItems > 0 && u.inventory.length + totalItems > INVENTORY_CAP) {
    return res.status(400).json({ error: `Not enough inventory space (need ${totalItems} slots, have ${INVENTORY_CAP - u.inventory.length})` });
  }

  ensureUserCurrencies(u);
  let totalGold = 0;
  let totalItemCount = 0;

  for (const mail of uncollected) {
    if (mail.gold > 0) {
      u.currencies.gold = (u.currencies.gold || 0) + mail.gold;
      totalGold += mail.gold;
    }
    for (const item of (mail.items || [])) {
      u.inventory.push(item);
      totalItemCount++;
    }
    mail.collected = true;
    mail.read = true;
  }
  u.gold = u.currencies.gold;
  saveUsers();

  res.json({
    ok: true,
    mailsCollected: uncollected.length,
    goldCollected: totalGold,
    itemsCollected: totalItemCount,
    message: `Collected ${uncollected.length} mails: ${totalGold > 0 ? `${totalGold} gold` : ''}${totalItemCount > 0 ? ` + ${totalItemCount} items` : ''}`,
  });
  } finally { mailCollectLock.release(uid); }
});

// ─── POST /api/mail/:mailId/read — Mark mail as read ─────────────────────────

router.post('/api/mail/:mailId/read', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const mail = ensureMailbox(u).find(m => m.id === req.params.mailId);
  if (!mail) return res.status(404).json({ error: 'Mail not found' });
  mail.read = true;
  saveUsers();
  res.json({ ok: true });
});

// ─── POST /api/mail/:mailId/delete — Delete a mail ──────────────────────────

router.post('/api/mail/:mailId/delete', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const mailbox = ensureMailbox(u);
  const idx = mailbox.findIndex(m => m.id === req.params.mailId);
  if (idx === -1) return res.status(404).json({ error: 'Mail not found' });
  if (!mailbox[idx].collected && ((mailbox[idx].gold || 0) > 0 || (mailbox[idx].items || []).length > 0)) {
    return res.status(400).json({ error: 'Collect attachments before deleting' });
  }
  mailbox.splice(idx, 1);
  saveUsers();
  res.json({ ok: true });
});

module.exports = router;
