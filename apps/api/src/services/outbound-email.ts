// outbound-email.ts ΓÇö Sends emails via SMTP using nodemailer
// Reads SMTP config from system_settings, interpolates email templates
// Logs all sent emails to email_log table

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { pool } from '../db/pool';
import { loadTemplates, findTemplate, interpolateSubject, interpolateBody } from './email-template-engine';
import type { TemplateVariables } from './email-template-engine';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

let transporter: Transporter | null = null;
let cachedSmtpConfig: SmtpConfig | null = null;

export async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const result = await pool.query(
    "SELECT key, value FROM system_settings WHERE key IN ('smtp_host','smtp_port','smtp_secure','smtp_user','smtp_password','smtp_from_email','smtp_from_name')"
  );
  const map: Record<string, string> = {};
  result.rows.forEach(r => { map[r.key] = r.value; });

  if (!map.smtp_host) return null;

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || '587'),
    secure: map.smtp_secure === 'true',
    user: map.smtp_user || '',
    password: map.smtp_password || '',
    fromEmail: map.smtp_from_email || map.smtp_user || '',
    fromName: map.smtp_from_name || 'IT Support',
  };
}

async function getTransporter(): Promise<Transporter | null> {
  const config = await loadSmtpConfig();
  if (!config || !config.host) return null;

  // Reuse transporter if config hasn't changed
  if (cachedSmtpConfig &&
      cachedSmtpConfig.host === config.host &&
      cachedSmtpConfig.port === config.port &&
      cachedSmtpConfig.user === config.user &&
      cachedSmtpConfig.password === config.password) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });

  cachedSmtpConfig = config;
  return transporter;
}

export async function testSmtpConnection(config?: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
  try {
    const transport = nodemailer.createTransport({
      host: config?.host || cachedSmtpConfig?.host || '',
      port: config?.port || cachedSmtpConfig?.port || 587,
      secure: config?.secure ?? cachedSmtpConfig?.secure ?? false,
      auth: {
        user: config?.user || cachedSmtpConfig?.user || '',
        pass: config?.password || cachedSmtpConfig?.password || '',
      },
    });
    await transport.verify();
    transport.close();
    return { success: true, message: 'SMTP connection successful' };
  } catch (err: any) {
    return { success: false, message: err.message || 'SMTP connection failed' };
  }
}

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

/**
 * Send an email notification using a named template.
 * Returns the messageId if successful, or null if SMTP is not configured or send failed.
 */
export async function sendTemplateEmail(
  toEmail: string,
  toName: string,
  templateName: string,
  variables: TemplateVariables,
  ticketId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = await loadSmtpConfig();
    if (!config || !config.host) {
      await logEmail(ticketId || null, 'outbound', toEmail, `[SKIPPED] ${templateName}`, 'SMTP not configured', 'failed', 'SMTP not configured');
      return { success: false, error: 'SMTP not configured' };
    }

    const templates = await loadTemplates();
    const template = findTemplate(templates, templateName);
    if (!template) {
      return { success: false, error: `Template "${templateName}" not found` };
    }

    const subject = interpolateSubject(template.subject, variables);
    const body = interpolateBody(template.body, variables);
    const fullBody = body + `\n\n---\nThis email was sent by Resolv IT Service Management.`;

    const transport = await getTransporter();
    if (!transport) {
      await logEmail(ticketId || null, 'outbound', toEmail, subject, body, 'failed', 'No transporter available');
      return { success: false, error: 'No transporter available' };
    }

    const info = await transport.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject,
      text: fullBody,
    });

    await logEmail(ticketId || null, 'outbound', toEmail, subject, body, 'sent', undefined, info.messageId);
    return { success: true, messageId: info.messageId };
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

// Invalidate the cached transporter (e.g., after SMTP settings change)
export function invalidateTransporter(): void {
  transporter = null;
  cachedSmtpConfig = null;
}
