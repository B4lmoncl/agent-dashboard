/**
 * Email Service — AgentMail integration for password reset + verification emails.
 *
 * AgentMail API requires sending through an inbox:
 * 1. Create inbox once (POST /v0/inboxes) → get inbox_id
 * 2. Send emails through that inbox (POST /v0/inboxes/{id}/messages/send)
 */

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || '';
// CLAUDE.md + .env.example document AGENTMAIL_FROM (full sender address like
// "qu3st-h4ll@agentmail.to"). The AgentMail inbox-create API wants just the
// username part. Extract it if FROM is set as a full email, otherwise fall
// back to the older AGENTMAIL_USERNAME var (for anyone running the old config),
// otherwise the hardcoded default.
function resolveUsername() {
  const from = (process.env.AGENTMAIL_FROM || '').trim();
  if (from) return from.includes('@') ? from.split('@')[0] : from;
  return (process.env.AGENTMAIL_USERNAME || '').trim() || 'qu3st-h4ll';
}
const AGENTMAIL_USERNAME = resolveUsername();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_BASE = 'https://api.agentmail.to/v0';

// Cached inbox ID — created once, reused for all sends
let _inboxId = null;
let _inboxEmail = null;

function isEmailConfigured() {
  return !!AGENTMAIL_API_KEY;
}

/**
 * Ensure we have an inbox to send from. Finds existing or creates new.
 */
async function ensureInbox() {
  if (_inboxId) return _inboxId;

  // Try listing existing inboxes first
  try {
    const listRes = await fetch(`${API_BASE}/inboxes`, {
      headers: { 'Authorization': `Bearer ${AGENTMAIL_API_KEY}` },
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const inboxes = data.inboxes || data.data || data || [];
      if (Array.isArray(inboxes) && inboxes.length > 0) {
        // Find the qu3st-h4ll inbox specifically, or use first available
        const target = inboxes.find(i => (i.email || '').includes('qu3st-h4ll')) || inboxes[0];
        _inboxId = target.id || target.inbox_id;
        _inboxEmail = target.email;
        console.log(`[email] Using inbox: ${_inboxEmail} (id: ${_inboxId})`);
        return _inboxId;
      }
    }
  } catch (e) {
    console.warn('[email] Failed to list inboxes:', e.message);
  }

  // No inbox found — create one
  try {
    const res = await fetch(`${API_BASE}/inboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        username: AGENTMAIL_USERNAME,
        display_name: 'Quest Hall',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      _inboxId = data.id || data.inbox_id;
      _inboxEmail = data.email;
      console.log(`[email] Created inbox: ${_inboxEmail} (id: ${_inboxId})`);
      return _inboxId;
    }

    const errText = await res.text().catch(() => '');
    throw new Error(`Create inbox failed: ${res.status} ${errText}`);
  } catch (e) {
    console.warn('[email] Inbox setup failed:', e.message);
    throw e;
  }
}

/**
 * Send an email through the AgentMail inbox.
 */
async function sendEmail(to, subject, text) {
  if (!AGENTMAIL_API_KEY) {
    console.warn('[email] AGENTMAIL_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const inboxId = await ensureInbox();

    const res = await fetch(`${API_BASE}/inboxes/${inboxId}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
      },
      body: JSON.stringify({ to, subject, text }),
    });

    if (res.ok) {
      console.log(`[email] Sent "${subject}" to ${to}`);
      return { success: true };
    }

    const errData = await res.text().catch(() => 'Unknown error');
    console.warn(`[email] Send failed (${res.status}):`, errData);
    return { success: false, error: `Email service error (${res.status})` };
  } catch (err) {
    console.warn('[email] Send error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function sendPasswordResetEmail(toEmail, resetToken, userName) {
  const resetUrl = `${BASE_URL}?resetToken=${encodeURIComponent(resetToken)}`;
  const text = [
    `${userName || 'Adventurer'},`,
    '',
    'Someone asked to reset your password. Hopefully you. The Hall does not',
    'verify these things — that is your job.',
    '',
    'If it was you, the door is here:',
    resetUrl,
    '',
    'The link works for one hour. After that it forgets, like the rest of us.',
    '',
    'If it was not you, do nothing. Nothing is often the right answer.',
    '',
    '— The Hall',
  ].join('\n');

  return sendEmail(toEmail, 'Quest Hall — Password Reset', text);
}

async function sendVerificationEmail(toEmail, verifyToken, userName) {
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;
  const text = [
    `${userName || 'Adventurer'},`,
    '',
    'The door is open. The name is yours. The rest is up to you.',
    '',
    'One last formality: prove this address belongs to you.',
    verifyUrl,
    '',
    'The link holds for 24 hours. You can already play — but if you ever',
    'forget your password, the Hall needs somewhere to send the key.',
    '',
    '— The Hall',
  ].join('\n');

  return sendEmail(toEmail, 'Quest Hall — Verify Your Email', text);
}

module.exports = { isEmailConfigured, sendPasswordResetEmail, sendVerificationEmail };
