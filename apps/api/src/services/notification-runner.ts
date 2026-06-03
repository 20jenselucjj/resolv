// notification-runner.ts — Central event-based notification pipeline
// Called from ticket route handlers on every ticket event.
// Replaces scattered email logic with a unified dispatch system.

import { pool } from '../db/pool';
import { sendTemplateEmail, sendCustomEmail } from './outbound-email';
import { loadTemplates, findTemplate, interpolateSubject, interpolateBody, getDefaultTemplates } from './email-template-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationEventType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'ticket_assigned'
  | 'ticket_reassigned'
  | 'comment_added'
  | 'ticket_resolved'
  | 'ticket_closed';

export interface NotificationEvent {
  type: NotificationEventType;
  ticket: {
    id: string;
    number: number;
    title: string;
    description?: string;
    priority: string;
    status: string;
    ticket_type: string;
    category_id?: string | null;
    due_date?: string | null;
    created_at: string;
    created_by_id: string;
    assigned_to_id?: string | null;
  };
  previousTicket?: {
    priority?: string;
    status?: string;
    assigned_to_id?: string | null;
    [key: string]: any;
  };
  actor: {
    id: string;
    name: string;
    email: string;
  };
  comment?: {
    id: string;
    body: string;
    authorName: string;
  };
  oldAssignee?: { id: string; name: string; email: string };
  newAssignee?: { id: string; name: string; email: string };
}

interface ThrottlingConfig {
  enabled: boolean;
  default_cooldown_minutes: number;
  max_notifications_per_hour: number;
  suppress_after_resolve: boolean;
}

// ─── Formatting helpers (duplicated from tickets.ts for independence) ────────
function fmtPriority(p: string): string {
  const map: Record<string, string> = { low: 'P4 - Low', medium: 'P3 - Medium', high: 'P2 - High', critical: 'P1 - Critical' };
  return map[p] || p;
}
function fmtStatus(s: string): string {
  const map: Record<string, string> = { open: 'Open', in_progress: 'In Progress', waiting: 'Waiting on User', resolved: 'Resolved', closed: 'Closed' };
  return map[s] || s;
}
function fmtType(t: string): string {
  const map: Record<string, string> = { incident: 'Incident', service_request: 'Service Request', problem: 'Problem', change: 'Change Request' };
  return map[t] || t;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return 'None';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return d as string; }
}
function priorityColor(p: string): string {
  const map: Record<string, string> = { low: '#6b7280', medium: '#2563eb', high: '#f59e0b', critical: '#dc2626' };
  return map[p] || '#6b7280';
}
function statusColor(s: string): string {
  const map: Record<string, string> = { open: '#2563eb', in_progress: '#7c3aed', waiting: '#f59e0b', resolved: '#059669', closed: '#6b7280' };
  return map[s] || '#6b7280';
}

// ─── Core dispatch function ─────────────────────────────────────────────────

/**
 * Main entry point. Call this from any ticket event handler.
 * This is fire-and-forget — errors are caught and logged, never thrown.
 */
export async function dispatchNotifications(event: NotificationEvent): Promise<void> {
  try {
    // 1. Load throttling config
    const throttleConfig = await loadThrottlingConfig();

    // 2. Build the full email variables object (shared across all emails for this event)
    const emailVars = await buildEmailVariables(event);

    // 3. Determine recipients based on event type
    const recipients = await determineRecipients(event);

    // 4. Check throttling for each recipient
    const allowedRecipients = [];
    for (const recipient of recipients) {
      if (!throttleConfig.enabled || !await isThrottled(event.ticket.id, recipient.email, event.type, throttleConfig)) {
        allowedRecipients.push(recipient);
      }
    }

    // 5. Send standard template email based on event type
    await sendStandardEventEmail(event, emailVars, allowedRecipients);

    // 6. Check and fire matching auto-reply rules
    await fireMatchingRules(event, emailVars, allowedRecipients);

    // 7. Notify watchers/CCs
    await notifyWatchers(event, emailVars);

    // 8. Log all notifications for throttling
    for (const recipient of allowedRecipients) {
      await logNotification(event.ticket.id, recipient.email, event.type, getTemplateNameForEvent(event.type));
    }

  } catch (err: any) {
    console.error('[notification-runner] Dispatch failed:', err.message);
  }
}

// ─── Build email variables ──────────────────────────────────────────────────

async function buildEmailVariables(event: NotificationEvent): Promise<Record<string, any>> {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  // Look up requestor name
  let requestorName = 'Unknown';
  let requestorEmail = '';
  try {
    const r = await pool.query('SELECT name, email FROM users WHERE id = $1', [event.ticket.created_by_id]);
    if (r.rows.length > 0) { requestorName = r.rows[0].name; requestorEmail = r.rows[0].email; }
  } catch {}

  // Look up assignee name
  let assignedToName = 'Unassigned';
  if (event.ticket.assigned_to_id) {
    try {
      const a = await pool.query('SELECT name FROM users WHERE id = $1', [event.ticket.assigned_to_id]);
      if (a.rows.length > 0) assignedToName = a.rows[0].name;
    } catch {}
  }

  // Look up category name
  let categoryName = 'None';
  if (event.ticket.category_id) {
    try {
      const c = await pool.query('SELECT name FROM categories WHERE id = $1', [event.ticket.category_id]);
      if (c.rows.length > 0) categoryName = c.rows[0].name;
    } catch {}
  }

  return {
    ticket_id: event.ticket.number,
    ticket_title: event.ticket.title,
    ticket_url: `${webUrl}/dashboard/tickets/${event.ticket.id}`,
    priority: fmtPriority(event.ticket.priority),
    status: fmtStatus(event.ticket.status),
    requestor_name: requestorName,
    requestor_email: requestorEmail,
    assigned_to_name: assignedToName,
    agent_name: event.newAssignee?.name || assignedToName,
    created_at: fmtDate(event.ticket.created_at),
    due_date: fmtDate(event.ticket.due_date),
    category: categoryName,
    ticket_type: fmtType(event.ticket.ticket_type),
    description: event.ticket.description || '',
    priority_color: priorityColor(event.ticket.priority),
    status_color: statusColor(event.ticket.status),
    comment_body: event.comment?.body || '',
    previous_assignee: event.oldAssignee?.name || 'None',
  };
}

// ─── Determine recipients ───────────────────────────────────────────────────

interface Recipient {
  id?: string;
  email: string;
  name: string;
  role: 'requestor' | 'assignee' | 'watcher' | 'admin';
}

async function determineRecipients(event: NotificationEvent): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  const seen = new Set<string>();

  const addRecipient = (email: string, name: string, id?: string, role?: any) => {
    const key = email.toLowerCase();
    if (!seen.has(key) && email) {
      seen.add(key);
      recipients.push({ id, email, name, role: role || 'requestor' });
    }
  };

  // Don't notify the actor (person who caused the event) — they know what they did
  const actorEmail = event.actor.email?.toLowerCase();

  switch (event.type) {
    case 'ticket_created':
      // Notify requestor (unless they are the actor, e.g., agent creating on behalf)
      if (event.ticket.created_by_id !== event.actor.id) {
        const r = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.created_by_id]);
        if (r.rows.length > 0) addRecipient(r.rows[0].email, r.rows[0].name, event.ticket.created_by_id, 'requestor');
      }
      // If unassigned, notify all admins/agents
      if (!event.ticket.assigned_to_id) {
        const agents = await pool.query("SELECT id, email, name FROM users WHERE role IN ('admin', 'agent') AND is_active = true");
        for (const agent of agents.rows) {
          if (agent.email?.toLowerCase() !== actorEmail) {
            addRecipient(agent.email, agent.name, agent.id, 'admin');
          }
        }
      }
      break;

    case 'ticket_assigned':
    case 'ticket_reassigned':
      // Notify the new assignee
      if (event.newAssignee && event.newAssignee.email?.toLowerCase() !== actorEmail) {
        addRecipient(event.newAssignee.email, event.newAssignee.name, event.newAssignee.id, 'assignee');
      }
      // Also notify requestor
      if (event.ticket.created_by_id !== event.actor.id) {
        const r = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.created_by_id]);
        if (r.rows.length > 0) addRecipient(r.rows[0].email, r.rows[0].name, event.ticket.created_by_id, 'requestor');
      }
      break;

    case 'status_changed':
    case 'ticket_updated':
      // Notify requestor and assignee (whoever didn't cause the change)
      if (event.ticket.created_by_id !== event.actor.id) {
        const r = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.created_by_id]);
        if (r.rows.length > 0) addRecipient(r.rows[0].email, r.rows[0].name, event.ticket.created_by_id, 'requestor');
      }
      if (event.ticket.assigned_to_id && event.ticket.assigned_to_id !== event.actor.id) {
        const a = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.assigned_to_id]);
        if (a.rows.length > 0) addRecipient(a.rows[0].email, a.rows[0].name, event.ticket.assigned_to_id, 'assignee');
      }
      break;

    case 'comment_added':
      // Notify ticket creator and assignee (whoever didn't write the comment)
      if (event.ticket.created_by_id !== event.actor.id) {
        const r = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.created_by_id]);
        if (r.rows.length > 0) addRecipient(r.rows[0].email, r.rows[0].name, event.ticket.created_by_id, 'requestor');
      }
      if (event.ticket.assigned_to_id && event.ticket.assigned_to_id !== event.actor.id) {
        const a = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.assigned_to_id]);
        if (a.rows.length > 0) addRecipient(a.rows[0].email, a.rows[0].name, event.ticket.assigned_to_id, 'assignee');
      }
      break;

    case 'ticket_resolved':
    case 'ticket_closed':
      // Notify requestor
      if (event.ticket.created_by_id !== event.actor.id) {
        const r = await pool.query('SELECT email, name FROM users WHERE id = $1', [event.ticket.created_by_id]);
        if (r.rows.length > 0) addRecipient(r.rows[0].email, r.rows[0].name, event.ticket.created_by_id, 'requestor');
      }
      break;
  }

  return recipients;
}

// ─── Event-template mapping ──────────────────────────────────────────────────

function getTemplateNameForEvent(type: NotificationEventType): string {
  const map: Record<string, string> = {
    ticket_created: 'Ticket Created',
    ticket_assigned: 'Ticket Assigned',
    ticket_reassigned: 'Ticket Reassigned',
    status_changed: 'Ticket Created',
    ticket_updated: 'Ticket Created',
    comment_added: 'Comment Added',
    ticket_resolved: 'Ticket Resolved',
    ticket_closed: 'Ticket Resolved',
  };
  return map[type] || 'Ticket Created';
}

// ─── Send standard event email ──────────────────────────────────────────────

async function sendStandardEventEmail(
  event: NotificationEvent,
  emailVars: Record<string, any>,
  recipients: Recipient[]
): Promise<void> {
  const templateName = getTemplateNameForEvent(event.type);

  for (const recipient of recipients) {
    const vars: Record<string, any> = { ...emailVars, user_name: recipient.name };

    // For resolved/closed, add close_notes
    if (event.type === 'ticket_resolved' || event.type === 'ticket_closed') {
      vars.close_notes = event.ticket.description || 'Your ticket has been resolved.';
      vars.resolved_at = fmtDate(new Date().toISOString());
    }

    sendTemplateEmail(
      recipient.email,
      recipient.name,
      templateName,
      vars,
      event.ticket.id
    ).catch(err => console.error(`[notification-runner] Failed to send ${templateName} to ${recipient.email}:`, err.message));
  }
}

// ─── Fire matching auto-reply rules ─────────────────────────────────────────

async function fireMatchingRules(
  event: NotificationEvent,
  emailVars: Record<string, any>,
  recipients: Recipient[]
): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT * FROM auto_reply_rules WHERE enabled = true ORDER BY created_at ASC'
    );

    const rules = result.rows;
    if (rules.length === 0) return;

    for (const rule of rules) {
      // Check event match
      if (rule.event && rule.event !== 'any' && rule.event !== event.type) continue;

      // Check conditions
      const conditions = rule.conditions || {};

      if (conditions.ticket_type?.length > 0 && !conditions.ticket_type.includes(event.ticket.ticket_type)) continue;
      if (conditions.priority?.length > 0 && !conditions.priority.includes(event.ticket.priority)) continue;
      if (conditions.status?.length > 0 && !conditions.status.includes(event.ticket.status)) continue;
      if (conditions.category_id?.length > 0 && (!event.ticket.category_id || !conditions.category_id.includes(event.ticket.category_id))) continue;

      if (conditions.keyword?.trim()) {
        const kw = conditions.keyword.toLowerCase();
        const searchText = `${event.ticket.title} ${event.ticket.description || ''}`.toLowerCase();
        if (!searchText.includes(kw)) continue;
      }

      // Check duplicate suppression
      if (rule.suppress_duplicates) {
        const cooldown = rule.cooldown_minutes || 60;
        const recent = await pool.query(
          `SELECT id FROM notification_log
           WHERE ticket_id = $1 AND event_type = $2 AND sent_at > NOW() - INTERVAL '${cooldown} minutes'
           LIMIT 1`,
          [event.ticket.id, `auto_reply:${rule.id}`]
        );
        if (recent.rows.length > 0) continue;
      }

      // If rule has a template_id, load the template and use its subject/body
      let useSubject = rule.reply_subject;
      let useBody = rule.reply_body;
      if (rule.template_id) {
        try {
          const tplResult = await pool.query("SELECT value FROM system_settings WHERE key = 'email_templates'");
          let foundTemplate: { subject: string; body: string } | null = null;
          if (tplResult.rows.length > 0) {
            try {
              const dbTemplates = JSON.parse(tplResult.rows[0].value);
              if (Array.isArray(dbTemplates)) {
                foundTemplate = dbTemplates.find((t: any) => t.id === rule.template_id || t.name === rule.template_id);
              }
            } catch { /* ignore parse errors */ }
          }
          // Fall back to defaults
          if (!foundTemplate) {
            const defaults = getDefaultTemplates();
            const id = (rule.template_id || '').toLowerCase();
            foundTemplate = defaults.find(t => t.name.toLowerCase() === id) || null;
            // Also try matching by slugified name
            if (!foundTemplate) {
              const slugId = id.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              foundTemplate = defaults.find(t => t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === slugId) || null;
            }
          }
          if (foundTemplate) {
            useSubject = foundTemplate.subject;
            useBody = foundTemplate.body;
          }
        } catch { /* ignore lookup errors */ }
      }

      // Build interpolated subject/body
      const subject = interpolateSubject(useSubject, emailVars);
      const body = interpolateBody(useBody, emailVars);

      // Send to appropriate recipients
      if (rule.send_to_requester) {
        const requestor = recipients.find(r => r.role === 'requestor');
        if (requestor) {
          sendCustomEmail(requestor.email, requestor.name, subject, body, event.ticket.id)
            .catch(err => console.error(`[notification-runner] Auto-reply to requestor failed:`, err.message));
        }
      }

      if (rule.send_to_assignee) {
        const assignee = recipients.find(r => r.role === 'assignee');
        if (assignee) {
          sendCustomEmail(assignee.email, assignee.name, subject, body, event.ticket.id)
            .catch(err => console.error(`[notification-runner] Auto-reply to assignee failed:`, err.message));
        }
      }

      if (rule.notify_watchers) {
        const watchers = await getWatchers(event.ticket.id);
        for (const watcher of watchers) {
          sendCustomEmail(watcher.email, watcher.name, subject, body, event.ticket.id)
            .catch(err => console.error(`[notification-runner] Auto-reply to watcher failed:`, err.message));
        }
      }

      // Log auto-reply notification
      for (const recipient of recipients) {
        await logNotification(event.ticket.id, recipient.email, `auto_reply:${rule.id}`, rule.name);
      }
    }
  } catch (err: any) {
    console.error('[notification-runner] fireMatchingRules failed:', err.message);
  }
}

// ─── Watcher notifications ──────────────────────────────────────────────────

async function getWatchers(ticketId: string): Promise<{ email: string; name: string }[]> {
  try {
    const result = await pool.query(
      `SELECT COALESCE(u.email, tw.email) as email, COALESCE(u.name, tw.email) as name
       FROM ticket_watchers tw
       LEFT JOIN users u ON tw.user_id = u.id
       WHERE tw.ticket_id = $1`,
      [ticketId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function notifyWatchers(
  event: NotificationEvent,
  emailVars: Record<string, any>
): Promise<void> {
  const watchers = await getWatchers(event.ticket.id);
  if (watchers.length === 0) return;

  const templateName = getTemplateNameForEvent(event.type);

  for (const watcher of watchers) {
    // Don't notify watchers who are also the actor
    if (watcher.email.toLowerCase() === event.actor.email?.toLowerCase()) continue;

    const vars = { ...emailVars, user_name: watcher.name };

    sendTemplateEmail(
      watcher.email,
      watcher.name,
      templateName,
      vars,
      event.ticket.id
    ).catch(err => console.error(`[notification-runner] Failed to notify watcher ${watcher.email}:`, err.message));
  }
}

// ─── Throttling ─────────────────────────────────────────────────────────────

async function loadThrottlingConfig(): Promise<ThrottlingConfig> {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'throttling_config'");
    if (result.rows.length > 0) return JSON.parse(result.rows[0].value);
  } catch {}
  return { enabled: true, default_cooldown_minutes: 15, max_notifications_per_hour: 10, suppress_after_resolve: false };
}

async function isThrottled(
  ticketId: string,
  email: string,
  eventType: string,
  config: ThrottlingConfig
): Promise<boolean> {
  try {
    // Check cooldown: has this user been notified about this ticket for this event type recently?
    const cooldownResult = await pool.query(
      `SELECT sent_at FROM notification_log
       WHERE ticket_id = $1 AND user_email = $2 AND event_type = $3
       AND sent_at > NOW() - INTERVAL '${config.default_cooldown_minutes} minutes'
       ORDER BY sent_at DESC LIMIT 1`,
      [ticketId, email.toLowerCase(), eventType]
    );
    if (cooldownResult.rows.length > 0) return true;

    // Check hourly limit
    const hourlyResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM notification_log
       WHERE user_email = $1 AND sent_at > NOW() - INTERVAL '1 hour'`,
      [email.toLowerCase()]
    );
    if (parseInt(hourlyResult.rows[0].cnt) >= config.max_notifications_per_hour) return true;

  } catch (err: any) {
    console.error('[notification-runner] Throttle check failed:', err.message);
  }
  return false;
}

async function logNotification(
  ticketId: string,
  email: string,
  eventType: string,
  templateName: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notification_log (ticket_id, user_email, event_type, template_name)
       VALUES ($1, $2, $3, $4)`,
      [ticketId, email.toLowerCase(), eventType, templateName]
    );
  } catch (err: any) {
    console.error('[notification-runner] Failed to log notification:', err.message);
  }
}
