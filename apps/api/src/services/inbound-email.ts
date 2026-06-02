// inbound-email.ts — Gmail API polling listener for incoming emails
// Uses existing OAuth tokens (shared with directory sync) to poll Gmail inbox.
// Fetches unread messages via Gmail API, parses them with mailparser,
// creates tickets or adds comments based on subject pattern matching.

import { simpleParser } from 'mailparser';
import { pool } from '../db/pool';
import { logEmail } from './outbound-email';
import { getValidAccessToken } from '../routes/directory-sync/helpers';
import { getStoredTokens, httpsGet, httpsPostJson } from '../routes/oauth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let accessToken: string | null = null;

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface InboundConfig {
  pollIntervalSec: number;
  label: string;
  inboundEmailAddress?: string;
}

interface ParsingConfig {
  requireKnownSender: boolean;
  defaultPriority: string;
  defaultType: string;
  defaultStatus: string;
  domainWhitelist: string[];
  priorityKeywords: Record<string, string[]>;
  typeKeywords: Record<string, string[]>;
}

interface TicketTypeDefaults {
  [type: string]: { due_hours: number };
}

async function loadParsingConfig(): Promise<ParsingConfig> {
  try {
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'email_parsing_config'"
    );
    if (result.rows.length > 0) {
      const config = JSON.parse(result.rows[0].value);
      return {
        requireKnownSender: config.require_known_sender !== false,
        defaultPriority: config.default_priority || 'medium',
        defaultType: config.default_type || 'incident',
        defaultStatus: config.default_status || 'open',
        domainWhitelist: config.domain_whitelist || [],
        priorityKeywords: config.priority_keywords || {},
        typeKeywords: config.type_keywords || {},
      };
    }
  } catch { /* use defaults */ }
  return {
    requireKnownSender: true,
    defaultPriority: 'medium',
    defaultType: 'incident',
    defaultStatus: 'open',
    domainWhitelist: [],
    priorityKeywords: {},
    typeKeywords: {},
  };
}

async function loadInboundConfig(): Promise<InboundConfig> {
  const result = await pool.query(
    "SELECT key, value FROM system_settings WHERE key IN ('email_inbound_poll_interval','email_inbound_label','email_inbound_address')"
  );
  const map: Record<string, string> = {};
  result.rows.forEach(r => { map[r.key] = r.value; });

  return {
    pollIntervalSec: parseInt(map.email_inbound_poll_interval || '60'),
    label: map.email_inbound_label || 'INBOX',
    inboundEmailAddress: map.email_inbound_address || undefined,
  };
}

/**
 * Check if inbound email is enabled and OAuth is connected.
 */
async function isEnabled(): Promise<boolean> {
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'email_inbound_enabled'"
  );
  if (result.rows.length === 0 || result.rows[0].value !== 'true') return false;

  const tokens = await getStoredTokens();
  return tokens !== null;
}

/**
 * Refresh the Gmail API access token (delegates to directory sync token helper).
 */
async function refreshToken(): Promise<string> {
  try {
    accessToken = await getValidAccessToken();
    return accessToken;
  } catch (err: any) {
    console.error('[inbound-email] Token refresh failed:', err.message);
    throw err;
  }
}

/**
 * Extract ticket number from email subject.
 * Looks for patterns like: #1234, Ticket #1234, [Ticket #1234], Re: Ticket #1234
 */
function extractTicketNumber(subject: string): number | null {
  const match = subject.match(/#(\d+)/);
  if (!match) return null;
  const num = parseInt(match[1]);
  return isNaN(num) ? null : num;
}

/**
 * Find ticket number by examining email References / In-Reply-To headers
 * against our email_log. Handles replies to notification emails.
 */
function getReferences(parsed: any): string[] {
  const refs: string[] = [];
  const inReplyTo = parsed.inReplyTo;
  const references = parsed.references;
  if (inReplyTo) refs.push(inReplyTo);
  if (Array.isArray(references)) refs.push(...references);
  else if (typeof references === 'string') refs.push(references);
  return refs.filter(Boolean);
}

async function findTicketByReferences(parsed: any): Promise<number | null> {
  const refIds = getReferences(parsed);
  if (refIds.length === 0) return null;

  // Look up any of these message IDs in our email_log to find the linked ticket
  const result = await pool.query(
    `SELECT DISTINCT t.number FROM email_log e
     JOIN tickets t ON e.ticket_id = t.id
     WHERE e.message_id = ANY($1) AND e.ticket_id IS NOT NULL
     LIMIT 1`,
    [refIds]
  );
  return result.rows.length > 0 ? result.rows[0].number : null;
}

/**
 * Fallback: find the most recent ticket from the same sender within 72 hours,
 * but only if the email subject indicates it's a reply (Re:/Fwd:/etc.).
 * This handles users replying to their own sent emails.
 */
function isReplySubject(subject: string): boolean {
  return /^(Re|Fwd?|AW|WG):\s/i.test(subject);
}

async function findRecentTicketFromSender(fromEmail: string, subject: string): Promise<number | null> {
  if (!isReplySubject(subject)) return null;

  const result = await pool.query(
    `SELECT t.number FROM tickets t
     JOIN users u ON t.created_by_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     AND t.created_at > NOW() - INTERVAL '72 hours'
     ORDER BY t.created_at DESC LIMIT 1`,
    [fromEmail]
  );
  return result.rows.length > 0 ? result.rows[0].number : null;
}

/**
 * Find user by email address. Returns user record or null.
 */
async function findUserByEmail(email: string): Promise<{ id: string; name: string; role: string } | null> {
  const result = await pool.query(
    'SELECT id, name, role FROM users WHERE LOWER(email) = LOWER($1)',
    [email.trim().toLowerCase()]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Apply email routing rules to auto-assign ticket.
 */
async function applyRoutingRules(fromEmail: string): Promise<{ assignToId?: string; categoryId?: string; priority?: string }> {
  try {
    const result = await pool.query(
      "SELECT * FROM email_routing_rules WHERE is_active = true AND (from_pattern = '' OR LOWER($1) LIKE LOWER(from_pattern)) ORDER BY created_at",
      [fromEmail]
    );
    for (const rule of result.rows) {
      if (rule.from_pattern && !fromEmail.toLowerCase().includes(rule.from_pattern.toLowerCase())) continue;
      return {
        assignToId: rule.assign_to_id || undefined,
        categoryId: rule.category_id || undefined,
        priority: rule.priority || 'medium',
      };
    }
  } catch { /* routing rules optional */ }
  return {};
}

// Upload directory for email attachments
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

interface AttachmentInfo {
  filename: string;
  content: Buffer;
  mimeType: string;
}

/**
 * Load per-type ticket defaults (due date hours) from system_settings.
 */
async function loadTicketTypeDefaults(): Promise<TicketTypeDefaults> {
  try {
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'ticket_type_defaults'"
    );
    if (result.rows.length > 0) {
      return JSON.parse(result.rows[0].value);
    }
  } catch { /* use hardcoded defaults */ }
  return {
    incident: { due_hours: 24 },
    service_request: { due_hours: 72 },
    problem: { due_hours: 168 },
    change: { due_hours: 336 },
  };
}

/**
 * Calculate due_date from ticket_type_defaults.
 */
async function calculateDueDate(ticketType: string): Promise<Date | null> {
  const defaults = await loadTicketTypeDefaults();
  const typeConfig = defaults[ticketType];
  if (!typeConfig || !typeConfig.due_hours) return null;
  const due = new Date();
  due.setHours(due.getHours() + typeConfig.due_hours);
  return due;
}

/**
 * Save email attachments to disk and record them in ticket_attachments.
 */
async function saveEmailAttachments(
  ticketId: string,
  commentId: string | null,
  attachments: AttachmentInfo[],
  uploadedBy: string | null = null
): Promise<void> {
  for (const att of attachments) {
    const ext = path.extname(att.filename);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, storedName);

    fs.writeFileSync(storagePath, att.content);
    const stat = fs.statSync(storagePath);

    await pool.query(
      `INSERT INTO ticket_attachments (ticket_id, comment_id, uploaded_by, filename, original_name, mime_type, size_bytes, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [ticketId, commentId, uploadedBy, storedName, att.filename, att.mimeType, stat.size, storagePath]
    );
  }
}

/**
 * Extract attachments from a parsed email (mailparser result).
 */
function extractAttachments(parsed: any): AttachmentInfo[] {
  const attachments = parsed.attachments || [];
  return attachments.map((att: any) => ({
    filename: att.filename || 'attachment',
    content: att.content,
    mimeType: att.contentType || 'application/octet-stream',
  }));
}

/**
 * Process a new ticket creation from inbound email.
 */
async function createTicketFromEmail(fromEmail: string, fromName: string, subject: string, body: string, messageId: string, attachments?: AttachmentInfo[]): Promise<void> {
  const user = await findUserByEmail(fromEmail);
  const routing = await applyRoutingRules(fromEmail);
  const config = await loadParsingConfig();

  // If requireKnownSender is true and sender not found in system, skip
  if (config.requireKnownSender && !user) {
    console.log(`[inbound-email] Skipping email from unknown sender ${fromEmail} — require_known_sender is enabled`);
    const oauthEmail = await getOAuthEmail();
    await logEmail(null, 'inbound', oauthEmail, subject, body, 'skipped', 'unknown sender', messageId, fromEmail);
    return;
  }

  const ticketSubject = subject.replace(/^(Re|Fwd?|AW|WG):\s*/i, '').trim().substring(0, 500) || 'New email request';

  // ── Detect priority from subject keywords ──────────────────────────
  let detectedPriority = routing.priority || config.defaultPriority || 'medium';
  if (config.priorityKeywords && Object.keys(config.priorityKeywords).length > 0) {
    const subjectLower = ticketSubject.toLowerCase();
    for (const [level, keywords] of Object.entries(config.priorityKeywords)) {
      if (keywords.some(kw => subjectLower.includes(kw.toLowerCase()))) {
        detectedPriority = level;
        break; // First match wins (check highest priority first)
      }
    }
  }

  // ── Detect ticket type from subject/body keywords ──────────────────
  let detectedType = config.defaultType || 'incident';
  if (config.typeKeywords && Object.keys(config.typeKeywords).length > 0) {
    const searchText = `${ticketSubject} ${body}`.toLowerCase();
    for (const [type, keywords] of Object.entries(config.typeKeywords)) {
      if (keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
        detectedType = type;
        break;
      }
    }
  }

  // ── Domain whitelist check ─────────────────────────────────────────
  const senderDomain = fromEmail.split('@')[1]?.toLowerCase();
  if (config.domainWhitelist && config.domainWhitelist.length > 0 && senderDomain) {
    if (!config.domainWhitelist.some(d => senderDomain === d.toLowerCase() || senderDomain.endsWith('.' + d.toLowerCase()))) {
      console.log(`[inbound-email] Skipping email from ${fromEmail} — domain not in whitelist`);
      const oauthEmail2 = await getOAuthEmail();
      await logEmail(null, 'inbound', oauthEmail2, ticketSubject, body, 'skipped', 'domain not whitelisted', messageId, fromEmail);
      return;
    }
  }

  const ticketType = detectedType;
  const dueDate = await calculateDueDate(ticketType);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO tickets (title, description, priority, status, ticket_type, due_date, tags, created_by_id, assigned_to_id, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, ARRAY['email']::varchar[], $7, $8, $9)
       RETURNING *`,
      [
        ticketSubject,
        body,
        detectedPriority,
        config.defaultStatus,
        ticketType,
        dueDate ? dueDate.toISOString() : null,
        user?.id || null,
        routing.assignToId || null,
        routing.categoryId || null
      ]
    );
    const ticket = result.rows[0];

    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value) VALUES ($1, $2, 'created_via_email', $3)",
      [ticket.id, user?.id || null, ticket.status]
    );

    if (ticket.assigned_to_id) {
      await client.query(
        "INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, 'ticket_assigned', $2, $3, $4)",
        [ticket.assigned_to_id, `New email ticket #${ticket.number}: ${ticket.title}`, `From: ${fromName || fromEmail}`, ticket.id]
      );
    }

    await client.query('COMMIT');

    // Save any email attachments to the ticket
    if (attachments && attachments.length > 0) {
      try {
        await saveEmailAttachments(ticket.id, null, attachments, user?.id);
      } catch (attErr: any) {
        console.error('[inbound-email] Failed to save attachments:', attErr.message);
      }
    }

    // Log the email — use the OAuth email as the inbound address
    const loggedEmail = await getOAuthEmail();
    await logEmail(ticket.id, 'inbound', loggedEmail, subject, body, 'processed', undefined, messageId, fromEmail);

    console.log(`[inbound-email] Created ticket #${ticket.number} from ${fromEmail} (${attachments?.length || 0} attachments)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[inbound-email] Failed to create ticket from email:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Process a reply to an existing ticket via email.
 */
async function addCommentFromEmail(ticketNumber: number, fromEmail: string, fromName: string, body: string, messageId: string, attachments?: AttachmentInfo[]): Promise<void> {
  const ticketResult = await pool.query('SELECT id, created_by_id, assigned_to_id, title FROM tickets WHERE number = $1', [ticketNumber]);
  if (ticketResult.rows.length === 0) {
    console.log(`[inbound-email] Ticket #${ticketNumber} not found for email reply`);
    await logEmail(null, 'inbound', '', `Re: #${ticketNumber}`, body, 'failed', 'Ticket not found', messageId, fromEmail);
    return;
  }

  const ticket = ticketResult.rows[0];
  const user = await findUserByEmail(fromEmail);
  const authorId = user?.id || null;
  const authorName = fromName || fromEmail;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const commentBody = `[Via email from ${authorName}]\n\n${body}`;
    const commentResult = await client.query(
      "INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal) VALUES ($1, $2, $3, false) RETURNING id",
      [ticket.id, authorId, commentBody]
    );
    const commentId = commentResult.rows[0].id;

    if (ticket.assigned_to_id) {
      await client.query(
        "INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, 'new_comment', $2, $3, $4)",
        [ticket.assigned_to_id, `Email reply on ticket #${ticketNumber}: ${ticket.title}`, `From: ${authorName}`, ticket.id]
      );
    }

    if (ticket.created_by_id && ticket.created_by_id !== authorId) {
      await client.query(
        "INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, 'new_comment', $2, $3, $4)",
        [ticket.created_by_id, `New reply on your ticket #${ticketNumber}`, `A reply was added via email.`, ticket.id]
      );
    }

    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action) VALUES ($1, $2, 'email_reply')",
      [ticket.id, authorId]
    );

    await client.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticket.id]);

    await client.query('COMMIT');

    // Save any email attachments to the comment
    if (attachments && attachments.length > 0) {
      try {
        await saveEmailAttachments(ticket.id, commentId, attachments, authorId);
      } catch (attErr: any) {
        console.error('[inbound-email] Failed to save reply attachments:', attErr.message);
      }
    }

    await logEmail(ticket.id, 'inbound', `ticket+#${ticketNumber}`, `Re: #${ticketNumber}`, body, 'processed', undefined, messageId, fromEmail);

    console.log(`[inbound-email] Added comment to ticket #${ticketNumber} from ${fromEmail} (${attachments?.length || 0} attachments)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[inbound-email] Failed to add comment from email:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get the OAuth-authenticated user's email (used for logging the inbound address).
 */
async function getOAuthEmail(): Promise<string> {
  try {
    const configResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
    );
    if (configResult.rows.length > 0) {
      const config = JSON.parse(configResult.rows[0].value);
      if (config.oauthEmail) return config.oauthEmail;
    }
  } catch { /* ignore */ }
  return 'inbound';
}

/**
 * Decode base64url-encoded raw RFC 2822 message from Gmail API.
 */
function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

/**
 * Mark a Gmail message as read (removes the UNREAD label).
 */
async function markAsRead(messageId: string): Promise<void> {
  if (!accessToken) return;
  try {
    await httpsPostJson(
      `${GMAIL_API_BASE}/messages/${messageId}/modify`,
      accessToken,
      { removeLabelIds: ['UNREAD'] }
    );
  } catch (err: any) {
    console.error(`[inbound-email] Failed to mark message ${messageId} as read:`, err.message);
  }
}

/**
 * Process a single Gmail message.
 */
async function processMessage(messageId: string, gmailId: string, config?: InboundConfig): Promise<void> {
  if (!accessToken) return;

  try {
    // Check if already processed
    const existing = await pool.query('SELECT id FROM email_log WHERE message_id = $1', [gmailId]);
    if (existing.rows.length > 0) {
      console.log(`[inbound-email] Message already processed: ${gmailId}`);
      // Still mark as read since it was previously processed
      await markAsRead(messageId);
      return;
    }

    // Fetch raw RFC 2822 message
    const msg = await httpsGet(`${GMAIL_API_BASE}/messages/${messageId}?format=raw`, accessToken);
    if (!msg || !msg.raw) {
      console.log(`[inbound-email] No raw content for message ${messageId}, trying full format`);

      // Fallback: fetch full format and extract headers/body
      const fullMsg = await httpsGet(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, accessToken);
      if (!fullMsg || !fullMsg.payload) {
        console.log(`[inbound-email] Cannot parse message ${messageId} — skipping`);
        await markAsRead(messageId);
        return;
      }
      await processFullFormatMessage(fullMsg, gmailId, config);
      await markAsRead(messageId);
      return;
    }

    // Decode raw message and parse
    const rawEmail = decodeBase64Url(msg.raw);
    const parsed = await simpleParser(rawEmail);

    const subject = parsed.subject || '(no subject)';
    const fromEmail = parsed.from?.value?.[0]?.address || '';
    const fromName = parsed.from?.value?.[0]?.name || '';
    const htmlContent = typeof parsed.html === 'string' ? parsed.html : '';
    const textBody = parsed.text || htmlContent.replace(/<[^>]*>/g, '').substring(0, 5000) || '';

    // Check if To address matches configured inbound email address
    const toAddr = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
    const toAddress = toAddr?.value?.[0]?.address || '';
    if (config?.inboundEmailAddress && toAddress && !toAddress.toLowerCase().includes(config.inboundEmailAddress.toLowerCase())) {
      console.log(`[inbound-email] Skipping message ${gmailId} — To address mismatch: ${toAddress} does not match ${config.inboundEmailAddress}`);
      const oauthEmail = await getOAuthEmail();
      await logEmail(null, 'inbound', oauthEmail, subject, textBody, 'skipped', 'To address mismatch', gmailId, fromEmail);
      await markAsRead(messageId);
      return;
    }

    if (!fromEmail) {
      console.log(`[inbound-email] Skipping message ${messageId} — no sender email`);
      await markAsRead(messageId);
      return;
    }

    const ticketNumber = extractTicketNumber(subject);
    const emailAttachments = extractAttachments(parsed);

    if (ticketNumber) {
      await addCommentFromEmail(ticketNumber, fromEmail, fromName, textBody, gmailId, emailAttachments.length > 0 ? emailAttachments : undefined);
    } else {
      // Strategy 2: check References/In-Reply-To headers against email_log
      const refTicket = await findTicketByReferences(parsed);
      if (refTicket) {
        await addCommentFromEmail(refTicket, fromEmail, fromName, textBody, gmailId, emailAttachments.length > 0 ? emailAttachments : undefined);
      } else {
        // Strategy 3: check for recent ticket from same sender (only if subject shows it's a reply)
        const recentTicket = await findRecentTicketFromSender(fromEmail, subject);
        if (recentTicket) {
          console.log(`[inbound-email] Matched to recent ticket #${recentTicket} from sender ${fromEmail}`);
          await addCommentFromEmail(recentTicket, fromEmail, fromName, textBody, gmailId, emailAttachments.length > 0 ? emailAttachments : undefined);
        } else {
          const creationEnabled = await pool.query(
            "SELECT value FROM system_settings WHERE key = 'email_ticket_creation_enabled'"
          );
          if (creationEnabled.rows.length > 0 && creationEnabled.rows[0].value === 'true') {
            await createTicketFromEmail(fromEmail, fromName, subject, textBody, gmailId, emailAttachments.length > 0 ? emailAttachments : undefined);
          } else {
            console.log(`[inbound-email] Skipping new email — ticket creation disabled. Subject: ${subject}`);
            const oauthEmail = await getOAuthEmail();
            await logEmail(null, 'inbound', oauthEmail, subject, textBody, 'received', undefined, gmailId, fromEmail);
          }
        }
      }
    }

    // Mark as read after processing
    await markAsRead(messageId);
  } catch (err: any) {
    console.error('[inbound-email] Error processing message:', err.message);
    // Mark as read even on error to avoid reprocessing loops
    try { await markAsRead(messageId); } catch { /* best effort */ }
  }
}

/**
 * Process a Gmail message using the full (JSON) format as fallback
 * when raw format isn't available. Extracts headers and plain text body.
 */
async function processFullFormatMessage(fullMsg: any, gmailId: string, config?: InboundConfig): Promise<void> {
  const headers = fullMsg.payload.headers || [];
  const getHeader = (name: string) => {
    const h = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
    return h?.value || '';
  };

  const subject = getHeader('Subject') || '(no subject)';
  const fromHeader = getHeader('From');
  const fromEmail = fromHeader.match(/<([^>]+)>/) ? fromHeader.match(/<([^>]+)>/)![1] : fromHeader;
  const fromName = fromHeader.replace(/\s*<.*>/, '').trim();
  const toHeader = getHeader('To');
  const toAddress = toHeader.match(/<([^>]+)>/) ? toHeader.match(/<([^>]+)>/)![1] : toHeader;
  const messageIdHeader = getHeader('Message-ID') || gmailId;

  // Extract plain text body from the payload recursively
  const getBody = (part: any): string => {
    if (part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) {
      const textPart = part.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
      }
      for (const subpart of part.parts) {
        const text = getBody(subpart);
        if (text) return text;
      }
    }
    return '';
  };

  const textBody = getBody(fullMsg.payload).substring(0, 5000) || '(no body)';

  // Check if To address matches configured inbound email address
  if (config?.inboundEmailAddress && toAddress && !toAddress.toLowerCase().includes(config.inboundEmailAddress.toLowerCase())) {
    console.log(`[inbound-email] Skipping message ${gmailId} — To address mismatch: ${toAddress} does not match ${config.inboundEmailAddress}`);
    const oauthEmail = await getOAuthEmail();
      await logEmail(null, 'inbound', oauthEmail, subject, textBody, 'skipped', 'To address mismatch', gmailId, fromEmail);
      return;
    }

    if (!fromEmail) {
    console.log(`[inbound-email] Skipping message ${gmailId} — no sender email`);
    return;
  }

  const ticketNumber = extractTicketNumber(subject);

  if (ticketNumber) {
    await addCommentFromEmail(ticketNumber, fromEmail, fromName, textBody, messageIdHeader);
  } else {
    // Strategy 2: check References/In-Reply-To headers against email_log
    const inReplyTo = getHeader('In-Reply-To');
    const references = getHeader('References');
    const refParsed = { inReplyTo, references: references ? [references] : [] };
    const refTicket = await findTicketByReferences(refParsed);
    if (refTicket) {
      await addCommentFromEmail(refTicket, fromEmail, fromName, textBody, messageIdHeader);
    } else {
      // Strategy 3: check for recent ticket from same sender (only if subject shows it's a reply)
      const recentTicket = await findRecentTicketFromSender(fromEmail, subject);
      if (recentTicket) {
        console.log(`[inbound-email] Matched to recent ticket #${recentTicket} from sender ${fromEmail}`);
        await addCommentFromEmail(recentTicket, fromEmail, fromName, textBody, messageIdHeader);
      } else {
        const creationEnabled = await pool.query(
          "SELECT value FROM system_settings WHERE key = 'email_ticket_creation_enabled'"
        );
        if (creationEnabled.rows.length > 0 && creationEnabled.rows[0].value === 'true') {
          await createTicketFromEmail(fromEmail, fromName, subject, textBody, messageIdHeader);
        } else {
          console.log(`[inbound-email] Skipping new email — ticket creation disabled. Subject: ${subject}`);
          const oauthEmail = await getOAuthEmail();
          await logEmail(null, 'inbound', oauthEmail, subject, textBody, 'received', undefined, messageIdHeader, fromEmail);
        }
      }
    }
  }
}

/**
 * Poll Gmail for new unread messages.
 */
async function pollInbox(config: InboundConfig): Promise<void> {
  if (!accessToken) return;

  try {
    // Build query: unread messages in the configured label
    let query = 'is:unread';
    if (config.label && config.label !== 'INBOX') {
      query = `is:unread label:${config.label}`;
    }

    const url = `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=20`;
    const response = await httpsGet(url, accessToken);

    if (!response || !response.messages || response.messages.length === 0) return;

    console.log(`[inbound-email] Found ${response.messages.length} unread messages`);

    // Process messages in parallel with a concurrency limit of 3
    for (let i = 0; i < response.messages.length; i += 3) {
      const batch = response.messages.slice(i, i + 3);
      await Promise.all(batch.map((msg: any) => processMessage(msg.id, msg.id, config)));
    }
  } catch (err: any) {
    console.error('[inbound-email] Poll error:', err.message);
    // Token might be expired — clear and retry on next poll
    if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
      accessToken = null;
    }
  }
}

/**
 * Start the Gmail API polling listener.
 * Call once on server startup.
 */
export async function startInboundListener(): Promise<void> {
  if (isRunning) return;

  try {
    const enabled = await isEnabled();
    if (!enabled) {
      console.log('[inbound-email] Inbound email not enabled or OAuth not connected — skipping');
      return;
    }
  } catch (err: any) {
    console.log('[inbound-email] Could not check inbound status:', err.message);
    return;
  }

  isRunning = true;
  const config = await loadInboundConfig();

  // Initial token acquisition
  try {
    await refreshToken();
    console.log(`[inbound-email] Gmail API connected — monitoring label "${config.label}"`);
  } catch (err: any) {
    console.error('[inbound-email] Failed to acquire OAuth token:', err.message);
    isRunning = false;
    return;
  }

  // Poll on interval
  pollTimer = setInterval(async () => {
    if (!accessToken) {
      try { await refreshToken(); } catch { /* will retry next interval */ }
    }
    pollInbox(config).catch(err => console.error('[inbound-email] Poll cycle error:', err.message));
  }, config.pollIntervalSec * 1000);

  // Initial poll after 5 seconds
  setTimeout(() => {
    pollInbox(config).catch(() => {});
  }, 5000);

  console.log(`[inbound-email] Started polling every ${config.pollIntervalSec}s via Gmail API`);
}

/**
 * Stop the Gmail API polling listener.
 */
export async function stopInboundListener(): Promise<void> {
  isRunning = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  accessToken = null;
  console.log('[inbound-email] Stopped');
}

/**
 * Force an immediate poll (for testing).
 */
export async function forcePoll(): Promise<{ success: boolean; message: string }> {
  try {
    const enabled = await isEnabled();
    if (!enabled) return { success: false, message: 'Inbound email not enabled or OAuth not connected' };
  } catch {
    return { success: false, message: 'Could not check inbound status' };
  }

  if (!accessToken) {
    try { await refreshToken(); } catch (err: any) {
      return { success: false, message: `Token refresh failed: ${err.message}` };
    }
  }

  const config = await loadInboundConfig();

  try {
    await pollInbox(config);
    return { success: true, message: 'Poll complete' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Check if Gmail OAuth is connected and return status info.
 */
export async function getGmailStatus(): Promise<{ connected: boolean; email?: string; scopes?: string[] }> {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) return { connected: false };

    // Verify Gmail scopes are granted by checking the token
    const configResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
    );
    if (configResult.rows.length > 0) {
      const config = JSON.parse(configResult.rows[0].value);
      return {
        connected: config.oauthConnected === true,
        email: config.oauthEmail || undefined,
        scopes: config.oauthScopes || undefined,
      };
    }
    return { connected: true };
  } catch {
    return { connected: false };
  }
}
