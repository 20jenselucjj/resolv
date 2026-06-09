// email-transport.ts — Abstraction layer for email sending
// Routes through Gmail API, SMTP, or other configured transports

import nodemailer from 'nodemailer';
import { pool } from '../db/pool';

interface SendEmailOptions {
  to: string;
  toName?: string;
  from?: string;
  fromName?: string;
  subject: string;
  body: string;
  attachments?: { filename: string; content: Buffer; mimeType: string }[];
  threading?: { messageId?: string; inReplyTo?: string; references?: string[]; replyTo?: string };
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Account Helpers ─────────────────────────────────────────────────────────

/**
 * Get the active outbound email account (prefer default, fallback to any active).
 */
async function getOutboundAccount(): Promise<any | null> {
  const result = await pool.query(
    "SELECT * FROM email_accounts WHERE direction IN ('outbound', 'both') AND is_active = true ORDER BY is_default DESC LIMIT 1"
  );
  return result.rows[0] || null;
}

/**
 * Mask a password string: show last 4 characters only.
 */
function maskPassword(pw: string): string {
  if (!pw || pw.length <= 4) return '****';
  return '*'.repeat(pw.length - 4) + pw.slice(-4);
}

/**
 * Strip sensitive password field from an account row for API responses.
 */
function sanitizeAccount(account: any): any {
  if (!account) return account;
  const sanitized = { ...account };
  if (sanitized.password) {
    sanitized.password = maskPassword(sanitized.password);
  }
  return sanitized;
}

// ─── Main Send Function ──────────────────────────────────────────────────────

/**
 * Send an email — routes to the appropriate transport based on configured accounts.
 * Falls back to the existing Gmail API implementation when no email_accounts are
 * configured, maintaining backward compatibility.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const account = await getOutboundAccount();

  if (!account) {
    // Fallback to existing Gmail API if no email_accounts configured
    return sendViaExistingGmailApi(options);
  }

  switch (account.account_type) {
    case 'smtp':
      return sendViaSmtp(account, options);
    case 'gmail_api':
      return sendViaExistingGmailApi(options);
    default:
      return { success: false, error: `Unsupported account type: ${account.account_type}` };
  }
}

// ─── SMTP Transport ──────────────────────────────────────────────────────────

/**
 * Send an email via SMTP using nodemailer.
 */
async function sendViaSmtp(account: any, options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port || 587,
      secure: account.encryption === 'ssl',
      auth: account.username ? { user: account.username, pass: account.password } : undefined,
      tls: account.encryption === 'tls' || account.encryption === 'starttls'
        ? { rejectUnauthorized: false }
        : undefined,
    });

    const fromAddr = options.from || account.email_address;
    const fromDisplay = options.fromName || account.from_name || 'Resolv ITSM';

    const info = await transporter.sendMail({
      from: fromAddr ? `"${fromDisplay}" <${fromAddr}>` : fromDisplay,
      to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
      subject: options.subject,
      html: options.body,
      inReplyTo: options.threading?.inReplyTo || undefined,
      references: options.threading?.references || undefined,
      replyTo: options.threading?.replyTo || undefined,
      headers: options.threading?.messageId ? { 'Message-ID': `<${options.threading.messageId}>` } : undefined,
      attachments: options.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.mimeType,
      })),
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Gmail API Fallback ──────────────────────────────────────────────────────

/**
 * Fallback to existing Gmail API implementation.
 * Imported dynamically to avoid circular dependencies.
 */
async function sendViaExistingGmailApi(options: SendEmailOptions): Promise<SendEmailResult> {
  const { sendViaGmailApi } = await import('./outbound-email');
  return sendViaGmailApi(options.to, options.toName || '', options.subject, options.body, options.attachments, options.threading);
}

// ─── IMAP Connection Test ────────────────────────────────────────────────────

/**
 * Verify an SMTP or IMAP connection by attempting to connect.
 */
export async function testEmailAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  const result = await pool.query('SELECT * FROM email_accounts WHERE id = $1', [accountId]);
  if (result.rows.length === 0) return { success: false, error: 'Account not found' };

  const account = result.rows[0];

  try {
    if (account.account_type === 'smtp') {
      const transporter = nodemailer.createTransport({
        host: account.host,
        port: account.port || 587,
        secure: account.encryption === 'ssl',
        auth: account.username ? { user: account.username, pass: account.password } : undefined,
      });
      await transporter.verify();
    } else if (account.account_type === 'imap') {
      // For IMAP, we do a basic host/port connection check via nodemailer's SMTP test
      // as a proxy — a full IMAP test would require imapflow or similar
      const transporter = nodemailer.createTransport({
        host: account.host,
        port: account.port || 993,
        secure: account.encryption !== 'none',
        auth: account.username ? { user: account.username, pass: account.password } : undefined,
        tls: account.encryption === 'tls' || account.encryption === 'starttls'
          ? { rejectUnauthorized: false }
          : undefined,
      });
      // Using verify on an IMAP host's SMTP port is not ideal, but we'll
      // at least verify DNS resolution and TCP connectivity
      await transporter.verify();
    } else if (account.account_type === 'gmail_api') {
      // Gmail API test: just check that credentials are non-empty
      if (!account.email_address) {
        throw new Error('Gmail API account has no email address configured');
      }
    }

    await pool.query(
      'UPDATE email_accounts SET last_test_at = NOW(), last_test_success = true, last_test_error = NULL WHERE id = $1',
      [accountId]
    );
    return { success: true };
  } catch (err: any) {
    await pool.query(
      'UPDATE email_accounts SET last_test_at = NOW(), last_test_success = false, last_test_error = $1 WHERE id = $2',
      [err.message, accountId]
    );
    return { success: false, error: err.message };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { getOutboundAccount, sanitizeAccount, maskPassword };
