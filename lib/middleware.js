/**
 * Auth Middleware — JWT + legacy API key validation, admin key management.
 */
const { resolveAuth, getMasterKeyFromEnv } = require('./auth');
const { state } = require('./state');

// ─── getMasterKey — public accessor (used by routes) ────────────────────────
const getMasterKey = getMasterKeyFromEnv;

// ─── requireAuth — accepts JWT (Bearer) or legacy API key (x-api-key) ───────
// Attaches req.auth = { userId, userName, isAdmin } on success.
function requireAuth(req, res, next) {
  const auth = resolveAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Set Authorization: Bearer <token> header or X-API-Key header' });
  }
  req.auth = auth;
  // Track lastActiveAt for online status
  const uid = (auth.userId || auth.userName || '').toLowerCase();
  if (uid && state.users[uid]) {
    state.users[uid].lastActiveAt = new Date().toISOString();
  }
  next();
}

// ─── requireSelf — must be authenticated AND target matches own userId ───────
// Admins bypass the check.
function requireSelf(paramName = 'name') {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.auth.isAdmin) return next();

    const target = req.params[paramName]?.toLowerCase();
    const userId = req.auth.userId?.toLowerCase();
    const userName = req.auth.userName?.toLowerCase();

    if (target && (target === userId || target === userName)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden — you can only modify your own data' });
  };
}

function requireMasterKey(req, res, next) {
  const auth = resolveAuth(req);
  if (auth && auth.isAdmin) {
    req.auth = auth;
    return next();
  }
  return res.status(401).json({ error: 'Master key required' });
}

// Legacy alias for backward compat
const requireApiKey = requireAuth;

module.exports = {
  getMasterKey,
  requireAuth,
  requireSelf,
  requireMasterKey,
  requireApiKey,
};
