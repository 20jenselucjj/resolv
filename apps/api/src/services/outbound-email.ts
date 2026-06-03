// outbound-email.ts — Sends emails via Gmail REST API using OAuth 2.0
// Replaces the previous nodemailer/SMTP implementation.
// Logs all sent emails to email_log table.

import https from 'https';
import { URL } from 'url';
import { pool } from '../db/pool';
import { loadTemplates, findTemplate, interpolateSubject, interpolateBody } from './email-template-engine';
import type { TemplateVariables } from './email-template-engine';
import { oauthTokenRefresh } from './oauth-token-refresh';

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  mimeType: string;
}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  tenant?: string;
  provider: 'google' | 'microsoft';
  connected: boolean;
  email?: string;
  tokenExpiresAt?: string;
}

const GMAIL_API_BASE = 'https://gmail.googleapis.com';

// ─── Token Management ───────────────────────────────────────────────────────

export async function loadOutboundOAuthConfig(): Promise<OAuthConfig | null> {
  // Try smtp_oauth_config first
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'smtp_oauth_config'"
  );
  if (result.rows.length > 0) {
    try {
      const config = JSON.parse(result.rows[0].value);
      // Only return if config has a valid email — otherwise fall through
      if (config.email) return config;
    } catch {
      // parse failed, fall through to fallback
    }
  }

  // Fallback to directory_sync_config
  return loadDirectorySyncConfig();
}

export async function loadOutboundOAuthTokens(): Promise<OAuthTokens | null> {
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'smtp_oauth_tokens'"
  );
  if (result.rows.length === 0) return null;
  try {
    return JSON.parse(result.rows[0].value);
  } catch {
    return null;
  }
}

async function loadDirectorySyncTokens(): Promise<OAuthTokens | null> {
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'directory_sync_tokens'"
  );
  if (result.rows.length === 0) return null;
  try {
    return JSON.parse(result.rows[0].value);
  } catch {
    return null;
  }
}

async function loadDirectorySyncConfig(): Promise<OAuthConfig | null> {
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
  );
  if (result.rows.length === 0) return null;
  try {
    const raw = JSON.parse(result.rows[0].value);
    return {
      clientId: raw.clientId,
      clientSecret: raw.clientSecret,
      provider: 'google',
      connected: raw.connected ?? raw.oauthConnected ?? false,
      email: raw.email || raw.oauthEmail,
    };
  } catch {
    return null;
  }
}

/**
 * Get a valid access token for outbound email, refreshing if expired.
 */
export async function getOutboundAccessToken(): Promise<string | null> {
  const config = await loadOutboundOAuthConfig();
  if (!config) return null;

  // Try smtp_oauth_tokens first, fallback to directory_sync_tokens
  let tokens = await loadOutboundOAuthTokens();
  let tokenKey = 'smtp_oauth_tokens';
  let isDirectorySyncFallback = false;

  if (!tokens) {
    tokens = await loadDirectorySyncTokens();
    if (tokens) {
      tokenKey = 'directory_sync_tokens';
      isDirectorySyncFallback = true;
    }
  }

  if (!tokens) return null;

  // Check if token is still valid (5 min buffer)
  const expiryTime = new Date(tokens.expiry_date).getTime();
  if (Date.now() < expiryTime - 5 * 60 * 1000) {
    return tokens.access_token;
  }

  // Refresh the token
  try {
    const tokenEndpoint = config.provider === 'microsoft'
      ? `https://login.microsoftonline.com/${config.tenant || 'common'}/oauth2/v2.0/token`
      : 'https://oauth2.googleapis.com/token';

    const body: Record<string, string> = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    };

    const response = await oauthTokenRefresh(tokenEndpoint, body);

    if (response.error) {
      console.error('[outbound-email] Token refresh failed:', response.error_description || response.error);
      return null;
    }

    const newTokens: OAuthTokens = {
      access_token: response.access_token,
      refresh_token: response.refresh_token || tokens.refresh_token,
      expiry_date: new Date(Date.now() + (response.expires_in || 3600) * 1000).toISOString(),
    };

    // Save refreshed tokens back to the source key (smtp_oauth_tokens or directory_sync_tokens)
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [tokenKey, JSON.stringify(newTokens)]
    );

    // Only update config expiry if using smtp_oauth path
    // (directory_sync config is owned by the directory sync module)
    if (!isDirectorySyncFallback) {
      const updatedConfig = { ...config, tokenExpiresAt: newTokens.expiry_date };
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('smtp_oauth_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(updatedConfig)]
      );
    }

    return newTokens.access_token;
  } catch (err: any) {
    console.error('[outbound-email] Token refresh error:', err.message);
    return null;
  }
}

// ─── Gmail API Sending ──────────────────────────────────────────────────────

/**
 * MIME-encode a subject line if it contains non-ASCII characters.
 * Uses =?UTF-8?B?<base64>?= encoding per RFC 2047.
 */
function mimeEncodeSubject(subject: string): string {
  // Check if subject has any non-ASCII characters
  if (/^[\x00-\x7F]*$/.test(subject)) {
    return subject; // ASCII only — no encoding needed
  }
  const encoded = Buffer.from(subject, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Build an RFC 2822 MIME message and base64url-encode it for the Gmail API.
 */
function buildRawMessage(from: string, fromName: string, to: string, toName: string, subject: string, body: string, attachments?: EmailAttachment[]): string {
  const fromHeader = fromName ? `"${fromName}" <${from}>` : from;
  const toHeader = toName ? `"${toName}" <${to}>` : to;

  let fullMessage: string;

  if (!attachments || attachments.length === 0) {
    // Simple HTML email — no attachments
    const headers = [
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Subject: ${mimeEncodeSubject(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ];
    fullMessage = headers.join('\r\n');
  } else {
    // Multipart/mixed MIME message with attachments
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const parts: string[] = [];

    // Part 1: HTML body
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/html; charset="UTF-8"');
    parts.push('Content-Transfer-Encoding: 7bit');
    parts.push('');
    parts.push(body);

    // Parts 2+: Attachments
    for (const att of attachments) {
      const base64Content = att.content.toString('base64');
      // Split base64 into lines of 76 characters per RFC 2045
      const encoded = base64Content.match(/.{1,76}/g)?.join('\r\n') || base64Content;

      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(encoded);
    }

    // Closing boundary
    parts.push(`--${boundary}--`);

    const headers = [
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Subject: ${mimeEncodeSubject(subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      parts.join('\r\n'),
    ];
    fullMessage = headers.join('\r\n');
  }

  // Base64url encode (standard base64 with URL-safe chars, no padding)
  const utf8Bytes = Buffer.from(fullMessage, 'utf-8');
  return utf8Bytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Make an HTTPS POST to the Gmail API with JSON body.
 */
function gmailApiPost(path: string, token: string, body: any): Promise<any> {
  const url = new URL(`${GMAIL_API_BASE}${path}`);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res: any) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send an email via the Gmail API using OAuth2 access token.
 */
async function sendViaGmailApi(to: string, toName: string, subject: string, body: string, attachments?: EmailAttachment[]): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await loadOutboundOAuthConfig();
  if (!config?.email) {
    return { success: false, error: 'Outbound email not configured. Please connect Google Workspace OAuth.' };
  }

  const accessToken = await getOutboundAccessToken();
  if (!accessToken) {
    return { success: false, error: 'No valid OAuth token. Please reconnect Google Workspace.' };
  }

  const fromAddress = config.email;
  const fromName = 'IT Support'; // Hardcoded — no SMTP from_name config needed with Gmail API

  const raw = buildRawMessage(fromAddress, fromName, to, toName, subject, body, attachments);

  try {
    const response = await gmailApiPost('/gmail/v1/users/me/messages/send', accessToken, { raw });

    if (response.error) {
      return { success: false, error: response.error.message || 'Gmail API error' };
    }

    return { success: true, messageId: response.id || undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send via Gmail API' };
  }
}

// ─── Email Logging ──────────────────────────────────────────────────────────

export async function logEmail(ticketId: string | null, direction: 'outbound' | 'inbound', recipient: string, subject: string, body: string, status: string, error?: string, messageId?: string, senderEmail?: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_log (ticket_id, direction, recipient_email, sender_email, subject, body, status, error_message, message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ticketId, direction, recipient, senderEmail || '', subject, body, status, error || null, messageId || null]
    );
  } catch (err) {
    console.error('[email] Failed to log email:', err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send an email notification using a named template.
 */
export async function sendTemplateEmail(
  toEmail: string,
  toName: string,
  templateName: string,
  variables: TemplateVariables,
  ticketId?: string,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const templates = await loadTemplates();
    const template = findTemplate(templates, templateName);
    if (!template) {
      return { success: false, error: `Template "${templateName}" not found` };
    }

    const subject = interpolateSubject(template.subject, variables);
    const body = interpolateBody(template.body, variables);
    const fullBody = body + `\n\n---\nThis email was sent by Resolv IT Service Management.`;

    const result = await sendViaGmailApi(toEmail, toName, subject, fullBody, attachments);

    await logEmail(ticketId || null, 'outbound', toEmail, subject, body, result.success ? 'sent' : 'failed', result.error, result.messageId);

    return result;
  } catch (err: any) {
    await logEmail(ticketId || null, 'outbound', toEmail, `[ERROR] ${templateName}`, '', 'failed', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check if email notifications are enabled for a given event type.
 */
export async function isEmailEnabledForEvent(eventType: string): Promise<boolean> {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'notification_settings'");
    if (result.rows.length === 0) return isDefaultEnabled(eventType);
    const settings = JSON.parse(result.rows[0].value);
    return settings?.[eventType]?.email === true;
  } catch {
    return isDefaultEnabled(eventType);
  }
}

function isDefaultEnabled(eventType: string): boolean {
  const defaults: Record<string, boolean> = {
    ticket_created: true,
    ticket_assigned: true,
    ticket_updated: false,
    ticket_resolved: true,
    sla_breach: true,
    comment_added: false,
  };
  return defaults[eventType] ?? false;
}

export function invalidateTransporter(): void {
  // No-op — kept for backward compatibility;
  // previously invalidated cached nodemailer transporter.
}

/**
 * Send a custom email with explicit subject and body (no template lookup).
 */
export async function sendCustomEmail(
  toEmail: string,
  toName: string,
  subject: string,
  body: string,
  ticketId?: string,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fullBody = body + `\n\n---\nThis email was sent by Resolv IT Service Management.`;

    const result = await sendViaGmailApi(toEmail, toName, subject, fullBody, attachments);

    await logEmail(ticketId || null, 'outbound', toEmail, subject, body, result.success ? 'sent' : 'failed', result.error, result.messageId);

    return result;
  } catch (err: any) {
    await logEmail(ticketId || null, 'outbound', toEmail, subject, body, 'failed', err.message);
    return { success: false, error: err.message };
  }
}
