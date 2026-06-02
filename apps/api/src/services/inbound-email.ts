// inbound-email.ts ΓÇö IMAP polling listener for incoming emails
// Connects to any IMAP server (Gmail, Office 365, etc.) and polls for new emails.
// Processes emails: creates tickets from help@ inbox, adds comments from replies.
// Free ΓÇö no Gmail API billing required.

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { pool } from '../db/pool';
import { logEmail } from './outbound-email';

let imapClient: ImapFlow | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

interface InboundConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  folder: string;
  processedFolder: string;
  pollIntervalSec: number;
}

async function loadInboundConfig(): Promise<InboundConfig | null> {
  const result = await pool.query(
    "SELECT key, value FROM system_settings WHERE key LIKE 'email_inbound_%'"
  );
  const map: Record<string, string> = {};
  result.rows.forEach(r => { map[r.key] = r.value; });

  if (!map.email_inbound_host || !map.email_inbound_user || !map.email_inbound_password) return null;

  return {
    host: map.email_inbound_host,
    port: parseInt(map.email_inbound_port || '993'),
    user: map.email_inbound_user,
    password: map.email_inbound_password,
    folder: map.email_inbound_folder || 'INBOX',
    processedFolder: map.email_inbound_processed_folder || 'Processed',
    pollIntervalSec: parseInt(map.email_inbound_poll_interval || '60'),
  };
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
 * Find user by email address. Returns user record or null.
 */
async function findUserByEmail(email: string): Promise<{ id: string; name: string; role: string } | null> {
  const result = await pool.query('SELECT id, name, role FROM users WHERE LOWER(email) = LOWER($1)', [email.trim().toLowerCase()]);
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

/**
 * Process a new ticket creation from inbound email.
 */
async function createTicketFromEmail(fromEmail: string, fromName: string, subject: string, body: string, messageId: string): Promise<void> {
  // Find or match user
  const user = await findUserByEmail(fromEmail);
  const routing = await applyRoutingRules(fromEmail);

  const ticketSubject = subject.replace(/^(Re|Fwd?|AW|WG):\s*/i, '').trim().substring(0, 500) || 'New email request';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the ticket ΓÇö use matched user ID if found, otherwise null (guest ticket)
    const result = await client.query(
      `INSERT INTO tickets (title, description, priority, ticket_type, tags, created_by_id, assigned_to_id, category_id)
       VALUES ($1, $2, $3, 'incident', ARRAY['email']::varchar[], $4, $5, $6)
       RETURNING *`,
      [ticketSubject, body, routing.priority || 'medium', user?.id || null, routing.assignToId || null, routing.categoryId || null]
    );
    const ticket = result.rows[0];

    // Log activity
    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value) VALUES ($1, $2, 'created_via_email', $3)",
      [ticket.id, user?.id || null, ticket.status]
    );

    // Create notification for assigned user (if any)
    if (ticket.assigned_to_id) {
      await client.query(
        "INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, 'ticket_assigned', $2, $3, $4)",
        [ticket.assigned_to_id, `New email ticket #${ticket.number}: ${ticket.title}`, `From: ${fromName || fromEmail}`, ticket.id]
      );
    }

    await client.query('COMMIT');

    // Log the email ΓÇö use configured IMAP email as the recipient
    const cfg = await loadInboundConfig();
    const inboundEmail = cfg?.user || 'inbound';
    await logEmail(ticket.id, 'inbound', inboundEmail, subject, body, 'processed', undefined, messageId, fromEmail);

    console.log(`[inbound-email] Created ticket #${ticket.number} from ${fromEmail}`);

    // Emit real-time event (if fastify io is available globally ΓÇö handled via route context)
    // The socket.io instance is on fastify.io ΓÇö we emit from the route handler instead
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
async function addCommentFromEmail(ticketNumber: number, fromEmail: string, fromName: string, body: string, messageId: string): Promise<void> {
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

    // Insert comment with the user's ID if found, otherwise mark as external
    const commentBody = `[Via email from ${authorName}]\n\n${body}`;
    await client.query(
      "INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal) VALUES ($1, $2, $3, false)",
      [ticket.id, authorId, commentBody]
    );

    // Notify assigned agent about the reply
    if (ticket.assigned_to_id) {
      await client.query(
        "INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, 'new_comment', $2, $3, $4)",
        [ticket.assigned_to_id, `Email reply on ticket #${ticketNumber}: ${ticket.title}`, `From: ${authorName}`, ticket.id]
      );
    }

    // Notify ticket creator if different from replier
    if (ticket.created_by_id && ticket.created_by_id !== authorId) {
      await client.query(
        "INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, 'new_comment', $2, $3, $4)",
        [ticket.created_by_id, `New reply on your ticket #${ticketNumber}`, `A reply was added via email.`, ticket.id]
      );
    }

    // Log activity
    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action) VALUES ($1, $2, 'email_reply')",
      [ticket.id, authorId]
    );

    // Touch ticket updated_at
    await client.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticket.id]);

    await client.query('COMMIT');

    // Log the email
    await logEmail(ticket.id, 'inbound', `ticket+#${ticketNumber}`, `Re: #${ticketNumber}`, body, 'processed', undefined, messageId, fromEmail);

    console.log(`[inbound-email] Added comment to ticket #${ticketNumber} from ${fromEmail}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[inbound-email] Failed to add comment from email:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Process a single email message.
 */
async function processMessage(config: InboundConfig, message: any, seq: number): Promise<void> {
  try {
    // Fetch the full message
    const fetchResult = await imapClient!.fetchOne(String(seq), { source: true });
    if (!fetchResult || !fetchResult.source) {
      console.log(`[inbound-email] Skipping message seq=${seq} ΓÇö no source`);
      return;
    }

    const parsed = await simpleParser(fetchResult.source);
    const subject = parsed.subject || '(no subject)';
    const fromEmail = parsed.from?.value?.[0]?.address || '';
    const fromName = parsed.from?.value?.[0]?.name || '';
    const htmlContent = typeof parsed.html === 'string' ? parsed.html : '';
    const textBody = parsed.text || htmlContent.replace(/<[^>]*>/g, '').substring(0, 5000) || '';
    const messageId = parsed.messageId || '';

    if (!fromEmail) {
      console.log(`[inbound-email] Skipping message ΓÇö no sender email`);
      return;
    }

    // Check if already processed
    const existing = await pool.query('SELECT id FROM email_log WHERE message_id = $1', [messageId]);
    if (existing.rows.length > 0) {
      console.log(`[inbound-email] Message already processed: ${messageId}`);
      return;
    }

    const ticketNumber = extractTicketNumber(subject);

    if (ticketNumber) {
      // Reply to existing ticket
      await addCommentFromEmail(ticketNumber, fromEmail, fromName, textBody, messageId);
    } else {
      // New ticket
      const creationEnabled = await pool.query("SELECT value FROM system_settings WHERE key = 'email_ticket_creation_enabled'");
      if (creationEnabled.rows.length > 0 && creationEnabled.rows[0].value === 'true') {
        await createTicketFromEmail(fromEmail, fromName, subject, textBody, messageId);
      } else {
        console.log(`[inbound-email] Skipping new email ΓÇö ticket creation disabled. Subject: ${subject}`);
        const cfg = await loadInboundConfig();
        await logEmail(null, 'inbound', cfg?.user || 'inbound', subject, textBody, 'received', undefined, messageId, fromEmail);
      }
    }

    // Move to processed folder
    if (config.processedFolder) {
      try {
        await imapClient!.messageMove(String(seq), config.processedFolder);
      } catch {
        // Folder might not exist ΓÇö mark as seen instead
        try {
          await imapClient!.messageFlagsAdd(String(seq), ['\\Seen']);
        } catch { /* best effort */ }
      }
    }
  } catch (err) {
    console.error('[inbound-email] Error processing message:', err);
  }
}

/**
 * Poll the IMAP inbox for new messages.
 */
async function pollInbox(config: InboundConfig): Promise<void> {
  if (!imapClient) return;

  try {
    const mailbox = await imapClient.mailboxOpen(config.folder);
    const unseen = mailbox.exists;

    if (unseen === 0) return;

    console.log(`[inbound-email] Found ${unseen} messages, newest first`);

    // Fetch most recent messages (up to 20 at a time)
    const start = Math.max(1, unseen - 19);
    const messages = await imapClient.fetch(`${start}:${unseen}`, { flags: true, internalDate: true });

    for await (const msg of messages) {
      await processMessage(config, msg, msg.seq);
    }
  } catch (err) {
    console.error('[inbound-email] Poll error:', err);
    // If connection lost, reconnect
    try {
      await imapClient?.logout();
    } catch { /* already disconnected */ }
    imapClient = null;
  }
}

/**
 * Start the IMAP polling listener.
 * Call this once on server startup.
 */
export async function startInboundListener(): Promise<void> {
  if (isRunning) return;

  const config = await loadInboundConfig();
  if (!config) {
    console.log('[inbound-email] Inbound email not configured ΓÇö skipping');
    return;
  }

  isRunning = true;

  const connect = async () => {
    if (imapClient) {
      try { await imapClient.logout(); } catch { /* ignore */ }
    }

    imapClient = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: true,
      auth: { user: config.user, pass: config.password },
      logger: false,
    });

    imapClient.on('error', (err: Error) => {
      console.error('[inbound-email] IMAP connection error:', err.message);
    });

    try {
      await imapClient.connect();
      console.log(`[inbound-email] Connected to ${config.host}:${config.port} as ${config.user}`);
    } catch (err: any) {
      console.error('[inbound-email] Failed to connect:', err.message);
      imapClient = null;
    }
  };

  await connect();

  // Poll on interval
  pollTimer = setInterval(() => {
    if (!imapClient) {
      connect().catch(() => {});
      return;
    }
    pollInbox(config).catch(err => console.error('[inbound-email] Poll cycle error:', err));
  }, config.pollIntervalSec * 1000);

  // Initial poll
  setTimeout(() => {
    pollInbox(config).catch(() => {});
  }, 5000);

  console.log(`[inbound-email] Started polling every ${config.pollIntervalSec}s`);
}

/**
 * Stop the IMAP polling listener.
 */
export async function stopInboundListener(): Promise<void> {
  isRunning = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (imapClient) {
    try { await imapClient.logout(); } catch { /* ignore */ }
    imapClient = null;
  }
  console.log('[inbound-email] Stopped');
}

/**
 * Force an immediate poll (for testing).
 */
export async function forcePoll(): Promise<{ success: boolean; message: string }> {
  const config = await loadInboundConfig();
  if (!config) return { success: false, message: 'Inbound email not configured' };
  if (!imapClient) return { success: false, message: 'IMAP client not connected' };

  try {
    await pollInbox(config);
    return { success: true, message: 'Poll complete' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
