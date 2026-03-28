/**
 * Email Service — AgentMail integration for password reset + verification emails.
 *
 * AgentMail API requires sending through an inbox:
 * 1. Create inbox once (POST /v0/inboxes) → get inbox_id
 * 2. Send emails through that inbox (POST /v0/inboxes/{id}/messages/send)
 */

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || '';
const AGENTMAIL_USERNAME = process.env.AGENTMAIL_USERNAME || 'qu3st-h4ll';
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
