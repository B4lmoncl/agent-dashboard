/**
 * Email Service — AgentMail integration for password reset emails.
 */

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || '';
const AGENTMAIL_FROM = process.env.AGENTMAIL_FROM || 'qu3st-h4ll@agentmail.to';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function isEmailConfigured() {
  return !!AGENTMAIL_API_KEY;
}

/**
 * Send a password reset email via AgentMail API.
 * @param {string} toEmail - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} userName - Player name for greeting
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendPasswordResetEmail(toEmail, resetToken, userName) {
  if (!AGENTMAIL_API_KEY) {
    console.warn('[email] AGENTMAIL_API_KEY not configured — cannot send password reset email');
    return { success: false, error: 'Email service not configured' };
  }

  const resetUrl = `${BASE_URL}?resetToken=${encodeURIComponent(resetToken)}`;

  const subject = 'Quest Hall — Password Reset';
  const body = [
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

  try {
    const res = await fetch('https://api.agentmail.to/v0/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: AGENTMAIL_FROM,
        to: toEmail,
        subject,
        text: body,
      }),
    });

    if (res.ok) {
      console.log(`[email] Password reset email sent to ${toEmail}`);
      return { success: true };
    }

    const errData = await res.text().catch(() => 'Unknown error');
    console.warn(`[email] AgentMail API error (${res.status}):`, errData);
    return { success: false, error: `Email service error (${res.status})` };
  } catch (err) {
    console.warn('[email] Failed to send email:', err.message);
    return { success: false, error: 'Network error sending email' };
  }
}

/**
 * Send an email verification email via AgentMail API.
 * @param {string} toEmail - Recipient email address
 * @param {string} verifyToken - Email verification token
 * @param {string} userName - Player name for greeting
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendVerificationEmail(toEmail, verifyToken, userName) {
  if (!AGENTMAIL_API_KEY) {
    console.warn('[email] AGENTMAIL_API_KEY not configured — cannot send verification email');
    return { success: false, error: 'Email service not configured' };
  }

  const verifyUrl = `${BASE_URL}?verifyEmail=${encodeURIComponent(verifyToken)}`;

  const subject = 'Quest Hall — Verify Your Email';
  const body = [
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

  try {
    const res = await fetch('https://api.agentmail.to/v0/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: AGENTMAIL_FROM,
        to: toEmail,
        subject,
        text: body,
      }),
    });

    if (res.ok) {
      console.log(`[email] Verification email sent to ${toEmail}`);
      return { success: true };
    }

    const errData = await res.text().catch(() => 'Unknown error');
    console.warn(`[email] AgentMail API error (${res.status}):`, errData);
    return { success: false, error: `Email service error (${res.status})` };
  } catch (err) {
    console.warn('[email] Failed to send verification email:', err.message);
    return { success: false, error: 'Network error sending email' };
  }
}

module.exports = { isEmailConfigured, sendPasswordResetEmail, sendVerificationEmail };
