/**
 * Social Routes — Friends, Messages, and Trading system.
 */
const router = require('express').Router();
const { state, saveUsers, saveSocial, ensureUserCurrencies, EQUIPMENT_SLOTS, logActivity } = require('../lib/state');
const { now, getLevelInfo } = require('../lib/helpers');
const { requireAuth, requireSelf } = require('../lib/middleware');

// ─── Trade execution lock (prevents concurrent trade execution for same player) ──
const _tradeLocks = new Map();
function acquireTradeLock(playerId) {
  if (_tradeLocks.has(playerId)) return false;
  _tradeLocks.set(playerId, true);
  return true;
}
function releaseTradeLock(playerId) {
  _tradeLocks.delete(playerId);
}

// ─── Friendship Index (O(1) lookup instead of O(n) array scan) ───────────────
// Lazily built on first access, maintained on add/remove
let _friendIndex = null; // Map<playerId, Set<friendId>>

function ensureFriendIndex() {
  if (_friendIndex) return;
  _friendIndex = new Map();
  for (const f of (state.socialData.friendships || [])) {
    if (!_friendIndex.has(f.player1)) _friendIndex.set(f.player1, new Set());
    if (!_friendIndex.has(f.player2)) _friendIndex.set(f.player2, new Set());
    _friendIndex.get(f.player1).add(f.player2);
    _friendIndex.get(f.player2).add(f.player1);
  }
}

function addToFriendIndex(a, b) {
  ensureFriendIndex();
  if (!_friendIndex.has(a)) _friendIndex.set(a, new Set());
  if (!_friendIndex.has(b)) _friendIndex.set(b, new Set());
  _friendIndex.get(a).add(b);
  _friendIndex.get(b).add(a);
}

function removeFromFriendIndex(a, b) {
  if (!_friendIndex) return;
  _friendIndex.get(a)?.delete(b);
  _friendIndex.get(b)?.delete(a);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function areFriends(a, b) {
  ensureFriendIndex();
  return _friendIndex.get(a)?.has(b) || false;
}

/** Check if an item instanceId is currently equipped by a user. */
function isItemEquipped(u, instanceId) {
  if (!u.equipment) return false;
  for (const slot of EQUIPMENT_SLOTS) {
    const eq = u.equipment[slot];
    if (!eq) continue;
    if (typeof eq === 'object' && (eq.instanceId === instanceId || eq.id === instanceId)) return true;
    if (typeof eq === 'string' && eq === instanceId) return true;
  }
  return false;
}

/** Validate that a player owns and can trade the specified items. Returns { ok, error, items }. */
function validateTradeItems(u, uid, itemInstanceIds) {
  if (!Array.isArray(itemInstanceIds) || itemInstanceIds.length === 0) return { ok: true, items: [] };
  // Deduplicate to prevent trading the same item twice
  const uniqueIds = [...new Set(itemInstanceIds)];
  const inv = u.inventory || [];
  const resolved = [];
  for (const instanceId of uniqueIds) {
    const item = inv.find(i => i.id === instanceId || i.instanceId === instanceId);
    if (!item) {
      return { ok: false, error: `Item ${instanceId} not found in ${uid}'s inventory` };
    }
    if (isItemEquipped(u, item.id || item.instanceId || instanceId)) {
      return { ok: false, error: `Item ${instanceId} is currently equipped and cannot be traded` };
    }
    resolved.push(item);
  }
  return { ok: true, items: resolved };
}

// ─── Friends System ───────────────────────────────────────────────────────────

// GET /api/social/:playerId/friends — list friends with online status
router.get('/api/social/:playerId/friends', requireAuth, requireSelf('playerId'), (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });

  const friends = state.socialData.friendships
    .filter(f => f.player1 === uid || f.player2 === uid)
    .map(f => {
      const friendId = f.player1 === uid ? f.player2 : f.player1;
      const friendUser = state.users[friendId];
      // Determine online status from agent store + lastActiveAt
      const agentEntry = state.store.agents[friendId];
      const agentOnline = agentEntry ? agentEntry.status === 'online' : false;
      const lastActiveAt = friendUser?.lastActiveAt || null;
      // Online: agent online OR active within 5 min. Idle: active within 30 min.
      const msSinceActive = lastActiveAt ? Date.now() - new Date(lastActiveAt).getTime() : Infinity;
      const onlineStatus = agentOnline || msSinceActive < 5 * 60 * 1000
        ? 'online'
        : msSinceActive < 30 * 60 * 1000
          ? 'idle'
          : 'offline';
      return {
        id: friendId,
        name: friendUser?.name || friendId,
        avatar: friendUser?.avatar || (friendUser?.name || friendId)[0],
        color: friendUser?.color || '#a78bfa',
        since: f.since,
        isOnline: onlineStatus === 'online',
        onlineStatus,
        lastActiveAt,
        level: friendUser ? getLevelInfo(friendUser.xp || 0).level : 0,
        classId: friendUser?.classId || null,
      };
    });

  res.json({ friends });
});

// POST /api/social/friend-request — send friend request
router.post('/api/social/friend-request', requireAuth, (req, res) => {
  const fromId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  if (!fromId || !state.users[fromId]) return res.status(401).json({ error: 'Unauthorized' });

  const targetPlayer = (req.body.targetPlayer || '').toLowerCase();
  if (!targetPlayer) return res.status(400).json({ error: 'targetPlayer is required' });
  if (!state.users[targetPlayer]) return res.status(404).json({ error: 'Target player not found' });
  if (fromId === targetPlayer) return res.status(400).json({ error: 'Cannot send friend request to yourself' });

  // Check if already friends
  if (areFriends(fromId, targetPlayer)) {
    return res.status(409).json({ error: 'Already friends with this player' });
  }

  // Check for existing pending request in either direction
  const existing = state.socialData.friendRequests.find(
    r => r.status === 'pending' && (
      (r.from === fromId && r.to === targetPlayer) ||
      (r.from === targetPlayer && r.to === fromId)
    )
  );
  if (existing) {
    return res.status(409).json({ error: 'A pending friend request already exists between you and this player' });
  }

  const request = {
    id: genId('fr'),
    from: fromId,
    to: targetPlayer,
    status: 'pending',
    createdAt: now(),
  };
  state.socialData.friendRequests.push(request);
  saveSocial();
  console.log(`[social] Friend request sent: ${fromId} → ${targetPlayer}`);
  res.json({ ok: true, request });
});

// POST /api/social/friend-request/:requestId/accept — accept friend request
router.post('/api/social/friend-request/:requestId/accept', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const request = state.socialData.friendRequests.find(r => r.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Friend request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Friend request is no longer pending' });
  if (request.to !== userId && !req.auth.isAdmin) {
    return res.status(403).json({ error: 'Only the recipient can accept a friend request' });
  }

  request.status = 'accepted';

  // Create friendship
  const friendship = {
    id: genId('fs'),
    player1: request.from,
    player2: request.to,
    since: now(),
  };
  state.socialData.friendships.push(friendship);
  addToFriendIndex(friendship.player1, friendship.player2);
  saveSocial();
  console.log(`[social] Friendship created: ${request.from} ↔ ${request.to}`);
  res.json({ ok: true, friendship });
});

// POST /api/social/friend-request/:requestId/decline — decline friend request
router.post('/api/social/friend-request/:requestId/decline', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const request = state.socialData.friendRequests.find(r => r.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Friend request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Friend request is no longer pending' });
  if (request.to !== userId && !req.auth.isAdmin) {
    return res.status(403).json({ error: 'Only the recipient can decline a friend request' });
  }

  request.status = 'declined';
  saveSocial();
  console.log(`[social] Friend request declined: ${request.from} → ${request.to}`);
  res.json({ ok: true });
});

// DELETE /api/social/friend/:friendId — remove friend
router.delete('/api/social/friend/:friendId', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const friendId = req.params.friendId.toLowerCase();

  const idx = state.socialData.friendships.findIndex(
    f => (f.player1 === userId && f.player2 === friendId) ||
         (f.player1 === friendId && f.player2 === userId)
  );
  if (idx === -1) return res.status(404).json({ error: 'Friendship not found' });

  state.socialData.friendships.splice(idx, 1);
  removeFromFriendIndex(userId, friendId);
  saveSocial();
  console.log(`[social] Friendship removed: ${userId} ↔ ${friendId}`);
  res.json({ ok: true });
});

// GET /api/social/:playerId/friend-requests — list pending requests
router.get('/api/social/:playerId/friend-requests', requireAuth, requireSelf('playerId'), (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });

  const incoming = state.socialData.friendRequests
    .filter(r => r.to === uid && r.status === 'pending')
    .map(r => {
      const fromUser = state.users[r.from];
      return {
        ...r,
        fromName: fromUser?.name || r.from,
        fromAvatar: fromUser?.avatar || (fromUser?.name || r.from)[0],
        fromColor: fromUser?.color || '#a78bfa',
      };
    });

  const outgoing = state.socialData.friendRequests
    .filter(r => r.from === uid && r.status === 'pending')
    .map(r => {
      const toUser = state.users[r.to];
      return {
        ...r,
        toName: toUser?.name || r.to,
      };
    });

  res.json({ incoming, outgoing });
});

// ─── Messages ─────────────────────────────────────────────────────────────────

// GET /api/social/:playerId/messages/:otherPlayerId — get conversation (paginated)
router.get('/api/social/:playerId/messages/:otherPlayerId', requireAuth, requireSelf('playerId'), (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  const otherId = req.params.otherPlayerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  if (!state.users[otherId]) return res.status(404).json({ error: 'Other player not found' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const before = req.query.before || null;

  let msgs = state.socialData.messages.filter(
    m => (m.from === uid && m.to === otherId) || (m.from === otherId && m.to === uid)
  );

  // Sort newest first for pagination
  msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (before) {
    const beforeTime = new Date(before).getTime();
    msgs = msgs.filter(m => new Date(m.createdAt).getTime() < beforeTime);
  }

  const page = msgs.slice(0, limit);

  // Mark messages to this player as read with timestamp
  let markedRead = 0;
  const readTimestamp = now();
  for (const m of state.socialData.messages) {
    if (m.from === otherId && m.to === uid && !m.read) {
      m.read = true;
      m.readAt = readTimestamp;
      markedRead++;
    }
  }
  if (markedRead > 0) saveSocial();

  // Return in chronological order
  res.json({
    messages: page.reverse(),
    hasMore: msgs.length > limit,
    total: msgs.length,
  });
});

// POST /api/social/message — send message
router.post('/api/social/message', requireAuth, (req, res) => {
  const fromId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  if (!fromId || !state.users[fromId]) return res.status(401).json({ error: 'Unauthorized' });

  const to = (req.body.to || '').toLowerCase();
  const text = (req.body.text || '').trim();

  if (!to) return res.status(400).json({ error: 'to is required' });
  if (!state.users[to]) return res.status(404).json({ error: 'Recipient not found' });
  if (fromId === to) return res.status(400).json({ error: 'Cannot send a message to yourself' });
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > 500) return res.status(400).json({ error: 'Message too long (max 500 characters)' });

  // Must be friends to message
  if (!areFriends(fromId, to)) {
    return res.status(403).json({ error: 'You must be friends to send messages' });
  }

  const message = {
    id: genId('msg'),
    from: fromId,
    to,
    text,
    createdAt: now(),
    read: false,
  };
  state.socialData.messages.push(message);
  saveSocial();
  console.log(`[social] Message sent: ${fromId} → ${to} (${text.length} chars)`);
  res.json({ ok: true, message });
});

// GET /api/social/:playerId/conversations — list all conversations with last message preview
router.get('/api/social/:playerId/conversations', requireAuth, requireSelf('playerId'), (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });

  // Build conversation map: partnerId → { lastMessage, unreadCount }
  const convMap = new Map();

  for (const m of state.socialData.messages) {
    let partnerId = null;
    if (m.from === uid) partnerId = m.to;
    else if (m.to === uid) partnerId = m.from;
    else continue;

    const existing = convMap.get(partnerId);
    const msgTime = new Date(m.createdAt).getTime();

    if (!existing || msgTime > new Date(existing.lastMessageAt).getTime()) {
      const partner = state.users[partnerId];
      convMap.set(partnerId, {
        playerId: partnerId,
        playerName: partner?.name || partnerId,
        playerAvatar: partner?.avatar || (partner?.name || partnerId)[0],
        playerColor: partner?.color || '#a78bfa',
        lastMessage: m.text.length > 100 ? m.text.slice(0, 100) + '...' : m.text,
        lastMessageAt: m.createdAt,
        unreadCount: (existing?.unreadCount || 0) + (m.to === uid && !m.read ? 1 : 0),
      });
    } else {
      // Update unread count for older messages
      if (m.to === uid && !m.read) {
        existing.unreadCount = (existing.unreadCount || 0) + 1;
      }
    }
  }

  // Sort by most recent message
  const conversations = Array.from(convMap.values())
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  res.json({ conversations });
});

// ─── Trade Response Helper ────────────────────────────────────────────────────

/** Transform internal trade to frontend-expected shape with enriched names/avatars/rounds */
function enrichTradeResponse(t) {
  const initiatorUser = state.users[t.initiator];
  const recipientUser = state.users[t.recipient];

  // Normalize status: pending_initiator/pending_recipient → "pending" + pendingFor
  const isPending = t.status === 'pending_initiator' || t.status === 'pending_recipient';
  const pendingFor = t.status === 'pending_initiator' ? t.initiator : t.status === 'pending_recipient' ? t.recipient : null;

  // Flatten currentOffer to top-level fields
  const currentInitiatorOffer = t.currentOffer?.initiatorOffer
    ? enrichOffer(t.currentOffer.initiatorOffer, t.initiator)
    : { gold: 0, items: [] };
  const currentRecipientOffer = t.currentOffer?.recipientOffer
    ? enrichOffer(t.currentOffer.recipientOffer, t.recipient)
    : { gold: 0, items: [] };

  // Build cumulative offer state per round for display
  const enrichedRounds = [];
  let runningInitiatorOffer = { gold: 0, items: [] };
  let runningRecipientOffer = { gold: 0, items: [] };
  for (const round of t.rounds) {
    const isInit = round.by === t.initiator;
    const enrichedOffer = enrichOffer(round.offer, round.by);
    if (isInit) {
      runningInitiatorOffer = enrichedOffer;
    } else {
      runningRecipientOffer = enrichedOffer;
    }
    enrichedRounds.push({
      by: round.by,
      byName: state.users[round.by]?.name || round.by,
      initiatorOffer: { ...runningInitiatorOffer },
      recipientOffer: { ...runningRecipientOffer },
      message: round.message || '',
      at: round.at,
    });
  }

  return {
    id: t.id,
    initiator: t.initiator,
    initiatorName: initiatorUser?.name || t.initiator,
    initiatorAvatar: initiatorUser?.avatar || (initiatorUser?.name || t.initiator)[0],
    initiatorColor: initiatorUser?.color || '#a78bfa',
    recipient: t.recipient,
    recipientName: recipientUser?.name || t.recipient,
    recipientAvatar: recipientUser?.avatar || (recipientUser?.name || t.recipient)[0],
    recipientColor: recipientUser?.color || '#a78bfa',
    status: isPending ? 'pending' : t.status,
    pendingFor,
    rounds: enrichedRounds,
    currentInitiatorOffer,
    currentRecipientOffer,
    initiatorAccepted: t.initiatorAccepted || false,
    recipientAccepted: t.recipientAccepted || false,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  };
}

/** Enrich an offer's item IDs into full item objects */
function enrichOffer(offer, ownerId) {
  const gold = offer?.gold || 0;
  const itemIds = offer?.items || [];
  const owner = state.users[ownerId];
  const items = itemIds.map(instanceId => {
    // Search by both `id` (loot/gacha items) and `instanceId` (gear instances)
    const invItem = owner ? (owner.inventory || []).find(i => i.id === instanceId || i.instanceId === instanceId) : null;
    return {
      instanceId,
      name: invItem?.name || instanceId,
      rarity: invItem?.rarity || 'common',
      icon: invItem?.icon || null,
      slot: invItem?.slot || null,
      stats: invItem?.stats || null,
      setName: invItem?.setName || invItem?.setId || null,
      legendaryEffect: invItem?.legendaryEffect || null,
    };
  });
  return { gold, items };
}

// ─── Trading System ───────────────────────────────────────────────────────────

// POST /api/social/trade/propose — propose a trade
router.post('/api/social/trade/propose', requireAuth, (req, res) => {
  const fromId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  if (!fromId || !state.users[fromId]) return res.status(401).json({ error: 'Unauthorized' });

  const to = (req.body.to || '').toLowerCase();
  const offer = req.body.offer || {};
  const message = (req.body.message || '').trim();

  if (!to) return res.status(400).json({ error: 'to is required' });
  if (!state.users[to]) return res.status(404).json({ error: 'Target player not found' });
  if (fromId === to) return res.status(400).json({ error: 'Cannot trade with yourself' });

  // Must be friends to trade
  if (!areFriends(fromId, to)) {
    return res.status(403).json({ error: 'You must be friends to trade' });
  }

  // Check for existing active trade between these players
  const existingTrade = state.socialData.trades.find(
    t => t.status === 'pending_initiator' || t.status === 'pending_recipient'
      ? ((t.initiator === fromId && t.recipient === to) || (t.initiator === to && t.recipient === fromId))
      : false
  );
  if (existingTrade) {
    return res.status(409).json({ error: 'An active trade already exists between you and this player', tradeId: existingTrade.id });
  }

  const u = state.users[fromId];
  ensureUserCurrencies(u);

  // Validate gold
  const offeredGold = Math.max(0, Math.floor(offer.gold || 0));
  if (offeredGold > 0 && u.currencies.gold < offeredGold) {
    return res.status(400).json({ error: `Insufficient gold. Have ${u.currencies.gold}, offering ${offeredGold}` });
  }

  // Validate items
  const itemIds = Array.isArray(offer.items) ? offer.items : [];
  const validation = validateTradeItems(u, fromId, itemIds);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const round = {
    by: fromId,
    offer: {
      gold: offeredGold,
      items: itemIds,
    },
    message: message.slice(0, 500),
    at: now(),
  };

  const trade = {
    id: genId('trade'),
    initiator: fromId,
    recipient: to,
    status: 'pending_recipient',
    rounds: [round],
    currentOffer: {
      initiatorOffer: { gold: offeredGold, items: itemIds },
      recipientOffer: null,
    },
    initiatorAccepted: false,
    recipientAccepted: false,
    completedAt: null,
    createdAt: now(),
  };

  state.socialData.trades.push(trade);
  saveSocial();
  console.log(`[social] Trade proposed: ${fromId} → ${to} (${offeredGold}g, ${itemIds.length} items)`);
  res.json({ ok: true, trade });
});

// GET /api/social/:playerId/trades — list all active + recent trades
router.get('/api/social/:playerId/trades', requireAuth, requireSelf('playerId'), (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });

  const trades = state.socialData.trades
    .filter(t => t.initiator === uid || t.recipient === uid)
    .sort((a, b) => {
      // Active trades first, then by most recent
      const isActive = t => t.status === 'pending_initiator' || t.status === 'pending_recipient';
      if (isActive(a) && !isActive(b)) return -1;
      if (!isActive(a) && isActive(b)) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 50) // Cap at 50 most recent
    .map(t => enrichTradeResponse(t));

  res.json({ trades });
});

// GET /api/social/trade/:tradeId — get trade details with full history
router.get('/api/social/trade/:tradeId', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const trade = state.socialData.trades.find(t => t.id === req.params.tradeId);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });

  // Only participants can view trade details
  if (trade.initiator !== userId && trade.recipient !== userId && !req.auth.isAdmin) {
    return res.status(403).json({ error: 'You are not a participant in this trade' });
  }

  res.json(enrichTradeResponse(trade));
});

// POST /api/social/trade/:tradeId/counter — counter-offer
router.post('/api/social/trade/:tradeId/counter', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const trade = state.socialData.trades.find(t => t.id === req.params.tradeId);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });

  // Check trade is active
  if (trade.status !== 'pending_initiator' && trade.status !== 'pending_recipient') {
    return res.status(400).json({ error: 'Trade is no longer active' });
  }

  // Determine whose turn it is
  const isInitiator = trade.initiator === userId;
  const isRecipient = trade.recipient === userId;
  if (!isInitiator && !isRecipient) {
    return res.status(403).json({ error: 'You are not a participant in this trade' });
  }

  // Only the player whose turn it is can counter
  if (trade.status === 'pending_initiator' && !isInitiator) {
    return res.status(403).json({ error: 'It is not your turn to respond to this trade' });
  }
  if (trade.status === 'pending_recipient' && !isRecipient) {
    return res.status(403).json({ error: 'It is not your turn to respond to this trade' });
  }

  const offer = req.body.offer || {};
  const message = (req.body.message || '').trim();

  const u = state.users[userId];
  ensureUserCurrencies(u);

  // Validate gold
  const offeredGold = Math.max(0, Math.floor(offer.gold || 0));
  if (offeredGold > 0 && u.currencies.gold < offeredGold) {
    return res.status(400).json({ error: `Insufficient gold. Have ${u.currencies.gold}, offering ${offeredGold}` });
  }

  // Validate items
  const itemIds = Array.isArray(offer.items) ? offer.items : [];
  const validation = validateTradeItems(u, userId, itemIds);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const round = {
    by: userId,
    offer: {
      gold: offeredGold,
      items: itemIds,
    },
    message: message.slice(0, 500),
    at: now(),
  };

  trade.rounds.push(round);

  // Update currentOffer
  if (isInitiator) {
    trade.currentOffer.initiatorOffer = { gold: offeredGold, items: itemIds };
  } else {
    trade.currentOffer.recipientOffer = { gold: offeredGold, items: itemIds };
  }

  // Reset acceptance since terms changed
  trade.initiatorAccepted = false;
  trade.recipientAccepted = false;

  // Swap whose turn it is
  trade.status = isInitiator ? 'pending_recipient' : 'pending_initiator';

  saveSocial();
  console.log(`[social] Trade counter-offer: ${userId} on trade ${trade.id} (${offeredGold}g, ${itemIds.length} items)`);
  res.json({ ok: true, trade });
});

// POST /api/social/trade/:tradeId/accept — accept current trade terms
router.post('/api/social/trade/:tradeId/accept', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const trade = state.socialData.trades.find(t => t.id === req.params.tradeId);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });

  if (trade.status !== 'pending_initiator' && trade.status !== 'pending_recipient') {
    return res.status(400).json({ error: 'Trade is no longer active' });
  }

  const isInitiator = trade.initiator === userId;
  const isRecipient = trade.recipient === userId;
  if (!isInitiator && !isRecipient) {
    return res.status(403).json({ error: 'You are not a participant in this trade' });
  }

  // Only the player whose turn it is can accept
  if (trade.status === 'pending_initiator' && !isInitiator) {
    return res.status(403).json({ error: 'It is not your turn to respond to this trade' });
  }
  if (trade.status === 'pending_recipient' && !isRecipient) {
    return res.status(403).json({ error: 'It is not your turn to respond to this trade' });
  }

  // Mark acceptance
  if (isInitiator) trade.initiatorAccepted = true;
  if (isRecipient) trade.recipientAccepted = true;

  // Check if BOTH sides have accepted
  if (trade.initiatorAccepted && trade.recipientAccepted) {
    // Acquire locks for both players to prevent concurrent trade execution
    if (!acquireTradeLock(trade.initiator) || !acquireTradeLock(trade.recipient)) {
      releaseTradeLock(trade.initiator);
      releaseTradeLock(trade.recipient);
      return res.status(429).json({ error: 'Trade in progress, please wait' });
    }
    try {
      // Execute the trade atomically
      const result = executeTrade(trade);
      if (!result.ok) {
        // Revert acceptance on failure
        if (isInitiator) trade.initiatorAccepted = false;
        if (isRecipient) trade.recipientAccepted = false;
        saveSocial();
        return res.status(400).json({ error: result.error });
      }

      saveSocial();
      saveUsers();
      logActivity(trade.initiator, 'trade_complete', { with: trade.recipient, summary: result.summary });
      logActivity(trade.recipient, 'trade_complete', { with: trade.initiator, summary: result.summary });
      console.log(`[social] Trade completed: ${trade.id} between ${trade.initiator} and ${trade.recipient}`);
      return res.json({ ok: true, trade, executed: true, summary: result.summary });
    } finally {
      releaseTradeLock(trade.initiator);
      releaseTradeLock(trade.recipient);
    }
  }

  // Only one side accepted — swap turn to the other player so they can accept too
  trade.status = isInitiator ? 'pending_recipient' : 'pending_initiator';
  saveSocial();
  console.log(`[social] Trade accepted by ${userId}, waiting for other party on trade ${trade.id}`);
  res.json({ ok: true, trade, executed: false, message: 'Waiting for the other player to accept' });
});

// POST /api/social/trade/:tradeId/decline — decline/cancel trade
router.post('/api/social/trade/:tradeId/decline', requireAuth, (req, res) => {
  const userId = req.auth.userId?.toLowerCase() || req.auth.userName?.toLowerCase();
  const trade = state.socialData.trades.find(t => t.id === req.params.tradeId);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });

  if (trade.status !== 'pending_initiator' && trade.status !== 'pending_recipient') {
    return res.status(400).json({ error: 'Trade is no longer active' });
  }

  if (trade.initiator !== userId && trade.recipient !== userId && !req.auth.isAdmin) {
    return res.status(403).json({ error: 'You are not a participant in this trade' });
  }

  trade.status = 'declined';
  trade.declinedBy = userId;
  trade.completedAt = now();

  saveSocial();
  console.log(`[social] Trade declined: ${trade.id} by ${userId}`);
  res.json({ ok: true, trade });
});

// ─── Trade Execution ──────────────────────────────────────────────────────────

function executeTrade(trade) {
  const u1 = state.users[trade.initiator];
  const u2 = state.users[trade.recipient];
  if (!u1 || !u2) return { ok: false, error: 'One or both players no longer exist' };

  ensureUserCurrencies(u1);
  ensureUserCurrencies(u2);

  const offer1 = (trade.currentOffer?.initiatorOffer) || { gold: 0, items: [] };
  const offer2 = (trade.currentOffer?.recipientOffer) || { gold: 0, items: [] };

  const gold1 = Math.max(0, Math.floor(offer1.gold || 0));
  const gold2 = Math.max(0, Math.floor(offer2.gold || 0));
  const items1 = offer1.items || [];
  const items2 = offer2.items || [];

  // ─── Verification: ensure both players still have what they offered ───

  // Verify gold
  if (gold1 > 0 && u1.currencies.gold < gold1) {
    return { ok: false, error: `${trade.initiator} no longer has enough gold (need ${gold1}, have ${u1.currencies.gold})` };
  }
  if (gold2 > 0 && u2.currencies.gold < gold2) {
    return { ok: false, error: `${trade.recipient} no longer has enough gold (need ${gold2}, have ${u2.currencies.gold})` };
  }

  // Verify inventory cap — check if receiving player would exceed cap
  const INVENTORY_CAP = 100;
  const u1NetGain = items2.length - items1.length;
  const u2NetGain = items1.length - items2.length;
  if (u1NetGain > 0 && (u1.inventory || []).length + u1NetGain > INVENTORY_CAP) {
    return { ok: false, error: `${trade.initiator}'s inventory would exceed ${INVENTORY_CAP} items` };
  }
  if (u2NetGain > 0 && (u2.inventory || []).length + u2NetGain > INVENTORY_CAP) {
    return { ok: false, error: `${trade.recipient}'s inventory would exceed ${INVENTORY_CAP} items` };
  }

  // Verify items still in inventory and not equipped
  const v1 = validateTradeItems(u1, trade.initiator, items1);
  if (!v1.ok) return { ok: false, error: v1.error };

  const v2 = validateTradeItems(u2, trade.recipient, items2);
  if (!v2.ok) return { ok: false, error: v2.error };

  // ─── Execute transfers atomically ─────────────────────────────────────

  // Transfer gold
  if (gold1 > 0) {
    u1.currencies.gold -= gold1;
    u2.currencies.gold += gold1;
  }
  if (gold2 > 0) {
    u2.currencies.gold -= gold2;
    u1.currencies.gold += gold2;
  }

  // Transfer items: initiator → recipient
  for (const instanceId of items1) {
    const idx = (u1.inventory || []).findIndex(i => i.id === instanceId);
    if (idx !== -1) {
      const item = u1.inventory.splice(idx, 1)[0];
      item.obtainedAt = now();
      item.source = `trade:${trade.id}`;
      if (!u2.inventory) u2.inventory = [];
      u2.inventory.push(item);
    }
  }

  // Transfer items: recipient → initiator
  for (const instanceId of items2) {
    const idx = (u2.inventory || []).findIndex(i => i.id === instanceId);
    if (idx !== -1) {
      const item = u2.inventory.splice(idx, 1)[0];
      item.obtainedAt = now();
      item.source = `trade:${trade.id}`;
      if (!u1.inventory) u1.inventory = [];
      u1.inventory.push(item);
    }
  }

  // Mark trade as completed
  trade.status = 'completed';
  trade.completedAt = now();

  const summary = {
    initiatorGave: { gold: gold1, itemCount: items1.length },
    recipientGave: { gold: gold2, itemCount: items2.length },
  };

  console.log(`[social] Trade executed: ${trade.initiator} gave ${gold1}g + ${items1.length} items, ${trade.recipient} gave ${gold2}g + ${items2.length} items`);
  return { ok: true, summary };
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

// GET /api/social/:playerId/activity-feed — recent events from friends
router.get('/api/social/:playerId/activity-feed', requireAuth, requireSelf('playerId'), (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });

  // Get friend IDs
  const friendIds = new Set(
    state.socialData.friendships
      .filter(f => f.player1 === uid || f.player2 === uid)
      .map(f => f.player1 === uid ? f.player2 : f.player1)
  );

  // Also include own events
  friendIds.add(uid);

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const log = state.socialData.activityLog || [];

  const feed = log
    .filter(e => friendIds.has(e.player))
    .slice(0, limit)
    .map(e => {
      const user = state.users[e.player];
      return {
        ...e,
        playerName: user?.name || e.player,
        playerAvatar: user?.avatar || (user?.name || e.player)[0],
        playerColor: user?.color || '#a78bfa',
      };
    });

  res.json({ feed });
});

module.exports = router;
