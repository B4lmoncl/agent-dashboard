/**
 * Email Service — AgentMail integration for password reset + verification emails.
 *
 * AgentMail API requires sending through an inbox:
 * 1. Create inbox once (POST /v0/inboxes) → get inbox_id
 * 2. Send emails through that inbox (POST /v0/inboxes/{id}/messages/send)
 */

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || '';
const AGENTMAIL_USERNAME = process.env.AGENTMAIL_USERNAME || 'quest-hall';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_BASE = 'https://api.agentmail.to/v0';

// Cached inbox ID — created once, reused for all sends
let _inboxId = null;
let _inboxEmail = null;

function isEmailConfigured() {
  return !!AGENTMAIL_API_KEY;
}

/**
 * Ensure we have an inbox to send from. Creates one if needed.
 */
async function ensureInbox() {
  if (_inboxId) return _inboxId;

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

  if (!res.ok) {
    // Maybe inbox already exists — try listing
    const listRes = await fetch(`${API_BASE}/inboxes`, {
      headers: { 'Authorization': `Bearer ${AGENTMAIL_API_KEY}` },
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const inboxes = data.inboxes || data.data || [];
      if (Array.isArray(inboxes) && inboxes.length > 0) {
        _inboxId = inboxes[0].inbox_id || inboxes[0].id;
        _inboxEmail = inboxes[0].email;
        console.log(`[email] Using existing inbox: ${_inboxEmail} (${_inboxId})`);
        return _inboxId;
      }
    }
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to create inbox: ${res.status} ${errText}`);
  }

  const data = await res.json();
  _inboxId = data.inbox_id || data.id;
  _inboxEmail = data.email;
  console.log(`[email] Created inbox: ${_inboxEmail} (${_inboxId})`);
  return _inboxId;
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
    `Hey ${userName || 'Adventurer'},`,
    '',
    'someone (hopefully you) requested a password reset for your Quest Hall account.',
    '',
    `Click here to reset your password: ${resetUrl}`,
    '',
    'This link expires in 1 hour. If you didn\'t request this, just ignore this email.',
    '',
    '— The Quest Hall',
  ].join('\n');

  return sendEmail(toEmail, 'Quest Hall — Password Reset', text);
}

async function sendVerificationEmail(toEmail, verifyToken, userName) {
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;
  const text = [
    `Welcome to Quest Hall, ${userName || 'Adventurer'}!`,
    '',
    'Please verify your email address by clicking the link below:',
    '',
    verifyUrl,
    '',
    'This link expires in 24 hours.',
    'You can already play — but password reset requires a verified email.',
    '',
    '— The Quest Hall',
  ].join('\n');

  return sendEmail(toEmail, 'Quest Hall — Verify Your Email', text);
}

module.exports = { isEmailConfigured, sendPasswordResetEmail, sendVerificationEmail };
