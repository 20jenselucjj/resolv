// scheduled-notifications.ts — Background scheduler for time-based notifications
// Runs periodic checks for:
//   1. Due date reminders (24h, 4h before due)
//   2. SLA breach warnings (50%, 75%, 90% thresholds)
//   3. Unassigned ticket escalation (after configurable minutes)
//   4. Satisfaction surveys (delayed after resolution)

import { pool } from '../db/pool';
import { sendTemplateEmail } from './outbound-email';
import type { TemplateVariables } from './email-template-engine';
import { fireScheduledWorkflows } from './workflow-engine';

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ─── Config interfaces ──────────────────────────────────────────────────────

interface ScheduleConfig {
  enabled: boolean;
  check_interval_seconds: number;
  due_date_reminder_hours: number[];
  sla_warning_thresholds: number[];
  unassigned_escalation_minutes: number;
  survey_delay_hours: number;
}

interface SurveyConfig {
  enabled: boolean;
  delay_hours: number;
  template_name: string;
  include_comment_field: boolean;
}

interface EscalationConfig {
  enabled: boolean;
  unassigned: {
    enabled: boolean;
    after_minutes: number;
    notify_role: string;
  };
  sla_breach: {
    enabled: boolean;
    notify_assignee: boolean;
    notify_manager: boolean;
  };
}

// ─── Formatting helpers ─────────────────────────────────────────────────────
// (Same as other files — self-contained)
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

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Overdue';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

// ─── Config loaders ─────────────────────────────────────────────────────────

async function loadScheduleConfig(): Promise<ScheduleConfig> {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'notification_schedule_config'");
    if (result.rows.length > 0) return JSON.parse(result.rows[0].value);
  } catch {}
  return {
    enabled: true, check_interval_seconds: 60,
    due_date_reminder_hours: [24, 4], sla_warning_thresholds: [50, 75, 90],
    unassigned_escalation_minutes: 30, survey_delay_hours: 24,
  };
}

async function loadSurveyConfig(): Promise<SurveyConfig> {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'satisfaction_survey_config'");
    if (result.rows.length > 0) return JSON.parse(result.rows[0].value);
  } catch {}
  return { enabled: true, delay_hours: 24, template_name: 'Satisfaction Survey', include_comment_field: true };
}

async function loadEscalationConfig(): Promise<EscalationConfig> {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'escalation_config'");
    if (result.rows.length > 0) return JSON.parse(result.rows[0].value);
  } catch {}
  return {
    enabled: true,
    unassigned: { enabled: true, after_minutes: 30, notify_role: 'admin' },
    sla_breach: { enabled: true, notify_assignee: true, notify_manager: true },
  };
}

// ─── Helper: build email vars for a ticket ──────────────────────────────────

async function buildTicketEmailVars(ticket: any): Promise<TemplateVariables> {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  let requestorName = 'Unknown';
  let assignedToName = 'Unassigned';
  let categoryName = 'None';

  try {
    const r = await pool.query('SELECT name FROM users WHERE id = $1', [ticket.created_by_id]);
    if (r.rows.length > 0) requestorName = r.rows[0].name;
  } catch {}

  if (ticket.assigned_to_id) {
    try {
      const a = await pool.query('SELECT name FROM users WHERE id = $1', [ticket.assigned_to_id]);
      if (a.rows.length > 0) assignedToName = a.rows[0].name;
    } catch {}
  }

  if (ticket.category_id) {
    try {
      const c = await pool.query('SELECT name FROM categories WHERE id = $1', [ticket.category_id]);
      if (c.rows.length > 0) categoryName = c.rows[0].name;
    } catch {}
  }

  return {
    ticket_id: ticket.number,
    ticket_title: ticket.title,
    ticket_url: `${webUrl}/dashboard/tickets/${ticket.id}`,
    priority: fmtPriority(ticket.priority),
    status: fmtStatus(ticket.status),
    requestor_name: requestorName,
    assigned_to_name: assignedToName,
    created_at: fmtDate(ticket.created_at),
    due_date: fmtDate(ticket.due_date),
    category: categoryName,
    ticket_type: fmtType(ticket.ticket_type),
    description: ticket.description || '',
    priority_color: priorityColor(ticket.priority),
    status_color: statusColor(ticket.status),
  };
}

// ─── Check 1: Due date reminders ────────────────────────────────────────────

async function checkDueDateReminders(config: ScheduleConfig): Promise<void> {
  if (!config.due_date_reminder_hours || config.due_date_reminder_hours.length === 0) return;

  for (const hoursBefore of config.due_date_reminder_hours) {
    try {
      // Find tickets with due_date within the reminder window
      // Only open/in_progress/waiting tickets with an assigned_to_id
      const result = await pool.query(
        `SELECT t.*,
         EXTRACT(EPOCH FROM (t.due_date - NOW())) * 1000 as remaining_ms
         FROM tickets t
         WHERE t.status IN ('open', 'in_progress', 'waiting')
         AND t.due_date IS NOT NULL
         AND t.due_date > NOW()
         AND t.due_date <= NOW() + INTERVAL '${hoursBefore} hours'
         AND t.due_date > NOW() + INTERVAL '${hoursBefore - 2} hours'`,
      );

      for (const ticket of result.rows) {
        // Check if we already sent this reminder
        const logKey = `due_date_reminder_${hoursBefore}h`;
        const existing = await pool.query(
          'SELECT id FROM notification_log WHERE ticket_id = $1 AND event_type = $2 LIMIT 1',
          [ticket.id, logKey]
        );
        if (existing.rows.length > 0) continue;

        const vars = await buildTicketEmailVars(ticket);
        vars.time_remaining = formatTimeRemaining(ticket.remaining_ms);

        // Send to assignee
        if (ticket.assigned_to_id) {
          const assignee = await pool.query('SELECT email, name FROM users WHERE id = $1', [ticket.assigned_to_id]);
          if (assignee.rows.length > 0) {
            sendTemplateEmail(
              assignee.rows[0].email,
              assignee.rows[0].name,
              'Due Date Reminder',
              { ...vars, user_name: assignee.rows[0].name },
              ticket.id
            ).catch(err => console.error(`[scheduler] Due date reminder failed:`, err.message));
          }
        }

        // Also send to requestor
        const requestor = await pool.query('SELECT email, name FROM users WHERE id = $1', [ticket.created_by_id]);
        if (requestor.rows.length > 0) {
          sendTemplateEmail(
            requestor.rows[0].email,
            requestor.rows[0].name,
            'Due Date Reminder',
            { ...vars, user_name: requestor.rows[0].name },
            ticket.id
          ).catch(err => console.error(`[scheduler] Due date reminder to requestor failed:`, err.message));
        }

        // Log
        await pool.query(
          'INSERT INTO notification_log (ticket_id, user_email, event_type, template_name) VALUES ($1, $2, $3, $4)',
          [ticket.id, 'system', logKey, 'Due Date Reminder']
        );

        console.log(`[scheduler] Sent ${hoursBefore}h due date reminder for ticket #${ticket.number}`);
      }
    } catch (err: any) {
      console.error(`[scheduler] Due date reminder check (${hoursBefore}h) failed:`, err.message);
    }
  }
}

// ─── Check 2: SLA breach warnings ───────────────────────────────────────────

async function checkSlaBreaches(config: ScheduleConfig): Promise<void> {
  if (!config.sla_warning_thresholds || config.sla_warning_thresholds.length === 0) return;

  try {
    // Get all active SLA policies
    const slaPolicies = await pool.query(
      'SELECT * FROM sla_policies WHERE is_active = true'
    );
    if (slaPolicies.rows.length === 0) return;

    // Build a map of priority -> resolution_time_hours
    const slaMap: Record<string, number> = {};
    for (const policy of slaPolicies.rows) {
      slaMap[policy.priority] = policy.resolution_time_hours;
    }

    // Find open tickets that have SLA policies
    const tickets = await pool.query(
      `SELECT t.*,
       EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600.0 as hours_elapsed
       FROM tickets t
       WHERE t.status IN ('open', 'in_progress', 'waiting')
       AND t.priority IN ('low', 'medium', 'high', 'critical')`
    );

    for (const ticket of tickets.rows) {
      const slaHours = slaMap[ticket.priority];
      if (!slaHours || slaHours <= 0) continue;

      const elapsed = parseFloat(ticket.hours_elapsed);
      const percentUsed = Math.floor((elapsed / slaHours) * 100);

      for (const threshold of config.sla_warning_thresholds) {
        if (percentUsed >= threshold) {
          // Check if already sent for this threshold
          const existing = await pool.query(
            'SELECT id FROM sla_notification_log WHERE ticket_id = $1 AND threshold_percent = $2 AND notification_type = $3',
            [ticket.id, threshold, 'warning']
          );
          if (existing.rows.length > 0) continue;

          const vars = await buildTicketEmailVars(ticket);
          vars.sla_threshold = String(threshold);
          const remainingMs = (slaHours - elapsed) * 3600000;
          vars.time_remaining = formatTimeRemaining(remainingMs);

          // Send to assignee
          if (ticket.assigned_to_id) {
            const assignee = await pool.query('SELECT email, name FROM users WHERE id = $1', [ticket.assigned_to_id]);
            if (assignee.rows.length > 0) {
              sendTemplateEmail(
                assignee.rows[0].email,
                assignee.rows[0].name,
                'SLA Breach Warning',
                { ...vars, user_name: assignee.rows[0].name },
                ticket.id
              ).catch(err => console.error(`[scheduler] SLA warning failed:`, err.message));
            }
          }

          // Also notify admins for high thresholds
          if (threshold >= 75) {
            const admins = await pool.query("SELECT email, name FROM users WHERE role = 'admin' AND is_active = true");
            for (const admin of admins.rows) {
              sendTemplateEmail(
                admin.email,
                admin.name,
                'SLA Breach Warning',
                { ...vars, user_name: admin.name },
                ticket.id
              ).catch(() => {});
            }
          }

          // Log to both notification_log and sla_notification_log
          await pool.query(
            'INSERT INTO notification_log (ticket_id, user_email, event_type, template_name) VALUES ($1, $2, $3, $4)',
            [ticket.id, 'system', `sla_warning_${threshold}`, 'SLA Breach Warning']
          );
          await pool.query(
            'INSERT INTO sla_notification_log (ticket_id, threshold_percent, notification_type) VALUES ($1, $2, $3)',
            [ticket.id, threshold, 'warning']
          );

          console.log(`[scheduler] SLA warning ${threshold}% for ticket #${ticket.number} (${percentUsed}% used)`);
        }
      }
    }
  } catch (err: any) {
    console.error('[scheduler] SLA breach check failed:', err.message);
  }
}

// ─── Check 3: Unassigned ticket escalation ──────────────────────────────────

async function checkUnassignedEscalation(config: ScheduleConfig, escalationConfig: EscalationConfig): Promise<void> {
  if (!escalationConfig.unassigned?.enabled) return;

  const afterMinutes = escalationConfig.unassigned.after_minutes || config.unassigned_escalation_minutes || 30;

  try {
    const result = await pool.query(
      `SELECT t.*, EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 60.0 as minutes_unassigned
       FROM tickets t
       WHERE t.assigned_to_id IS NULL
       AND t.status IN ('open', 'in_progress')
       AND t.created_at < NOW() - INTERVAL '${afterMinutes} minutes'`
    );

    for (const ticket of result.rows) {
      // Check if already escalated
      const existing = await pool.query(
        'SELECT id FROM notification_log WHERE ticket_id = $1 AND event_type = $2 LIMIT 1',
        [ticket.id, 'unassigned_escalation']
      );
      if (existing.rows.length > 0) continue;

      const vars = await buildTicketEmailVars(ticket);
      vars.escalation_reason = `Ticket has been unassigned for ${Math.floor(parseFloat(ticket.minutes_unassigned))} minutes`;
      vars.time_overdue = formatTimeRemaining(parseFloat(ticket.minutes_unassigned) * 60000);

      // Notify admins/agents
      const notifyRole = escalationConfig.unassigned.notify_role || 'admin';
      const recipients = await pool.query(
        'SELECT email, name FROM users WHERE role = $1 AND is_active = true',
        [notifyRole]
      );

      for (const recipient of recipients.rows) {
        sendTemplateEmail(
          recipient.email,
          recipient.name,
          'Escalation Notice',
          { ...vars, user_name: recipient.name },
          ticket.id
        ).catch(err => console.error(`[scheduler] Escalation email failed:`, err.message));
      }

      // Log
      await pool.query(
        'INSERT INTO notification_log (ticket_id, user_email, event_type, template_name) VALUES ($1, $2, $3, $4)',
        [ticket.id, 'system', 'unassigned_escalation', 'Escalation Notice']
      );

      console.log(`[scheduler] Escalated unassigned ticket #${ticket.number} (${Math.floor(parseFloat(ticket.minutes_unassigned))}min)`);
    }
  } catch (err: any) {
    console.error('[scheduler] Unassigned escalation check failed:', err.message);
  }
}

// ─── Check 4: Satisfaction surveys ──────────────────────────────────────────

async function checkSatisfactionSurveys(config: ScheduleConfig, surveyConfig: SurveyConfig): Promise<void> {
  if (!surveyConfig.enabled) return;

  const delayHours = surveyConfig.delay_hours || config.survey_delay_hours || 24;

  try {
    // Find resolved/closed tickets that were resolved at least delayHours ago
    // and don't have a survey sent yet
    const result = await pool.query(
      `SELECT t.id, t.number, t.title, t.created_by_id, t.assigned_to_id, t.resolved_at, t.closed_at
       FROM tickets t
       WHERE t.status IN ('resolved', 'closed')
       AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
       AND COALESCE(t.resolved_at, t.closed_at) < NOW() - INTERVAL '${delayHours} hours'
       AND NOT EXISTS (
         SELECT 1 FROM satisfaction_surveys s WHERE s.ticket_id = t.id
       )
       LIMIT 50`
    );

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    for (const ticket of result.rows) {
      // Create survey record
      await pool.query(
        'INSERT INTO satisfaction_surveys (ticket_id, user_id, sent_at) VALUES ($1, $2, NOW())',
        [ticket.id, ticket.created_by_id]
      );

      // Get requestor email
      const requestor = await pool.query('SELECT email, name FROM users WHERE id = $1', [ticket.created_by_id]);
      if (requestor.rows.length === 0) continue;

      let assignedToName = 'Support Team';
      if (ticket.assigned_to_id) {
        const a = await pool.query('SELECT name FROM users WHERE id = $1', [ticket.assigned_to_id]);
        if (a.rows.length > 0) assignedToName = a.rows[0].name;
      }

      // Build survey URLs with rating pre-selected
      const surveyBase = `${webUrl}/api/satisfaction/${ticket.id}/rate`;

      const vars: Record<string, string | number | undefined> = {
        ticket_id: ticket.number,
        ticket_title: ticket.title,
        user_name: requestor.rows[0].name,
        assigned_to_name: assignedToName,
        resolved_at: fmtDate(ticket.resolved_at || ticket.closed_at),
        ticket_url: `${webUrl}/dashboard/tickets/${ticket.id}`,
        survey_url_1: `${surveyBase}?rating=1`,
        survey_url_2: `${surveyBase}?rating=2`,
        survey_url_3: `${surveyBase}?rating=3`,
        survey_url_4: `${surveyBase}?rating=4`,
        survey_url_5: `${surveyBase}?rating=5`,
      };

      sendTemplateEmail(
        requestor.rows[0].email,
        requestor.rows[0].name,
        'Satisfaction Survey',
        vars,
        ticket.id
      ).catch(err => console.error(`[scheduler] Survey email failed:`, err.message));

      console.log(`[scheduler] Sent satisfaction survey for ticket #${ticket.number}`);
    }
  } catch (err: any) {
    console.error('[scheduler] Satisfaction survey check failed:', err.message);
  }
}

// ─── Main scheduler cycle ───────────────────────────────────────────────────

async function runSchedulerCycle(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const config = await loadScheduleConfig();
    if (!config.enabled) return;

    const escalationConfig = await loadEscalationConfig();
    const surveyConfig = await loadSurveyConfig();

    // Run all checks
    await Promise.allSettled([
      checkDueDateReminders(config),
      checkSlaBreaches(config),
      checkUnassignedEscalation(config, escalationConfig),
      checkSatisfactionSurveys(config, surveyConfig),
      fireScheduledWorkflows(),
    ]);

  } catch (err: any) {
    console.error('[scheduler] Cycle failed:', err.message);
  } finally {
    isRunning = false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Start the scheduled notification runner.
 * Call once on server startup.
 */
export async function startScheduledNotifications(): Promise<void> {
  if (schedulerTimer) return;

  const config = await loadScheduleConfig();
  if (!config.enabled) {
    console.log('[scheduler] Scheduled notifications disabled — skipping');
    return;
  }

  const intervalMs = (config.check_interval_seconds || 60) * 1000;

  // Initial run after 30 seconds
  setTimeout(() => {
    runSchedulerCycle().catch(() => {});
  }, 30000);

  // Then run on interval
  schedulerTimer = setInterval(() => {
    runSchedulerCycle().catch(err => console.error('[scheduler] Interval error:', err.message));
  }, intervalMs);

  console.log(`[scheduler] Started — checking every ${config.check_interval_seconds}s`);
}

/**
 * Stop the scheduled notification runner.
 */
export async function stopScheduledNotifications(): Promise<void> {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  console.log('[scheduler] Stopped');
}

/**
 * Force an immediate scheduler cycle (for testing).
 */
export async function forceSchedulerCycle(): Promise<{ success: boolean; message: string }> {
  try {
    await runSchedulerCycle();
    return { success: true, message: 'Scheduler cycle complete' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
