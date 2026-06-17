// sla-engine.ts — SLA policy assignment, due date calculation, breach detection
// Integrates with business-hours.ts for calendar-aware SLA calculations.
// Used by:
//   - tickets.ts (on create, comment, update priority)
//   - scheduled-notifications.ts (periodic breach detection)
//   - sla.ts (SLA stats/breach endpoints)

import { pool } from '../db/pool';
import { getCached, setCache } from '../lib/cache';
import {
  addBusinessHours,
  calculateBusinessHoursBetween,
  loadBusinessHoursConfig,
} from './business-hours';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SlaPolicy {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
}

export interface SlaAssignment {
  sla_policy_id: string;
  sla_policy_name: string;
  due_date: string;
  response_time_hours: number;
  resolution_time_hours: number;
}

export interface SlaBreachResult {
  ticket_id: string;
  ticket_number: number;
  ticket_title: string;
  priority: string;
  sla_policy_name: string;
  due_date: string;
  created_at: string;
  hours_overdue: number;
}

export interface SlaStats {
  total_tickets_with_sla: number;
  breached_count: number;
  compliant_count: number;
  compliance_rate: number;
  avg_response_time_hours: number;
  avg_resolution_time_hours: number;
  by_priority: Array<{
    priority: string;
    total: number;
    breached: number;
    compliant: number;
    rate: number;
  }>;
}

// ─── Cache helpers ──────────────────────────────────────────────────────────

const CACHE_TTL = 300_000; // 5 minutes

/**
 * Get all active SLA policies, cached.
 */
async function getActiveSlaPolicies(): Promise<SlaPolicy[]> {
  const cached = getCached<SlaPolicy[]>('sla_engine:policies');
  if (cached) return cached;

  const result = await pool.query<SlaPolicy>(
    'SELECT * FROM sla_policies WHERE is_active = true ORDER BY priority DESC'
  );
  setCache('sla_engine:policies', result.rows, CACHE_TTL);
  return result.rows;
}

/**
 * Find the most specific SLA policy for a given priority.
 * Returns the active policy matching that priority, or null.
 */
export async function findSlaPolicyForPriority(
  priority: string
): Promise<SlaPolicy | null> {
  const policies = await getActiveSlaPolicies();
  return policies.find((p) => p.priority === priority) ?? null;
}

// ─── SLA Assignment ─────────────────────────────────────────────────────────

/**
 * Assign an SLA policy to a ticket and calculate the due date.
 *
 * Steps:
 *  1. Look up the active SLA policy matching the ticket's priority.
 *  2. If found, calculate the resolution due date using business-hours-aware
 *     calendar math (skips weekends, holidays, after-hours).
 *  3. Update the ticket's sla_policy_id and due_date.
 *
 * Call this immediately after ticket INSERT and whenever priority changes.
 */
export async function assignSlaPolicy(
  client: any,
  ticketId: string,
  priority: string,
  createdAt: Date
): Promise<SlaAssignment | null> {
  const policy = await findSlaPolicyForPriority(priority);
  if (!policy) return null;

  // Calculate due date using business-hours-aware calendar math
  const dueDate = await addBusinessHours(createdAt, policy.resolution_time_hours);

  await client.query(
    `UPDATE tickets SET sla_policy_id = $1, due_date = $2 WHERE id = $3`,
    [policy.id, dueDate.toISOString(), ticketId]
  );

  return {
    sla_policy_id: policy.id,
    sla_policy_name: policy.name,
    due_date: dueDate.toISOString(),
    response_time_hours: policy.response_time_hours,
    resolution_time_hours: policy.resolution_time_hours,
  };
}

/**
 * Recalculate SLA when a ticket's priority changes.
 * Finds a new policy and re-calculates the due date from the ticket's
 * original created_at (fairer than from the change time).
 */
export async function recalculateSlaForPriorityChange(
  ticketId: string,
  newPriority: string
): Promise<SlaAssignment | null> {
  const ticket = await pool.query(
    'SELECT created_at FROM tickets WHERE id = $1',
    [ticketId]
  );
  if (ticket.rows.length === 0) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await assignSlaPolicy(
      client,
      ticketId,
      newPriority,
      new Date(ticket.rows[0].created_at)
    );
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── First Response Tracking ────────────────────────────────────────────────

/**
 * Record the first agent/admin response on a ticket.
 * Sets `first_response_at = NOW()` if it's currently NULL.
 *
 * Call this from the POST /tickets/:id/comments handler when the comment
 * author is an agent or admin and the ticket has no first_response yet.
 *
 * Returns true if first_response_at was set, false if it was already set.
 */
export async function recordFirstResponse(ticketId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE tickets SET first_response_at = NOW() WHERE id = $1 AND first_response_at IS NULL RETURNING id`,
    [ticketId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Breach Detection ───────────────────────────────────────────────────────

/**
 * Check a single ticket for SLA breach.
 *
 * A ticket is breached when:
 *  - It has an sla_policy_id and due_date
 *  - It is NOT in a terminal state (resolved/closed)
 *  - due_date < NOW() (using business hours if enabled)
 *
 * Returns true if the ticket was newly marked as breached.
 */
export async function checkTicketSlaBreach(ticketId: string): Promise<boolean> {
  const ticket = await pool.query(
    `SELECT id, due_date, sla_policy_id, status, sla_breached, created_at, priority
     FROM tickets
     WHERE id = $1 AND sla_policy_id IS NOT NULL AND due_date IS NOT NULL`,
    [ticketId]
  );

  if (ticket.rows.length === 0) return false;
  const t = ticket.rows[0];

  // Already breached or terminal — no-op
  if (t.sla_breached || t.status === 'resolved' || t.status === 'closed') {
    return false;
  }

  const policy = await findSlaPolicyForPriority(t.priority);
  if (!policy) return false;

  const config = await loadBusinessHoursConfig();
  const now = new Date();
  const createdAt = new Date(t.created_at);

  let isBreached = false;

  if (config.enabled && config.respect_for_sla) {
    const elapsedMs = await calculateBusinessHoursBetween(createdAt, now);
    const elapsedHours = elapsedMs / 3600000;
    isBreached = elapsedHours >= policy.resolution_time_hours;
  } else {
    isBreached = now > new Date(t.due_date);
  }

  if (isBreached) {
    await pool.query(
      `UPDATE tickets SET sla_breached = true, sla_breached_at = NOW() WHERE id = $1 AND sla_breached = false`,
      [ticketId]
    );
    return true;
  }

  return false;
}

/**
 * Batch SLA breach detection.
 *
 * Scans all open/in_progress/waiting tickets that have an SLA policy
 * assigned, checks if their due date has passed, and marks them as
 * breached. Also clears the breach flag for tickets that have been
 * resolved/closed (cleanup).
 *
 * Returns an array of newly breached tickets.
 */
export async function runSlaBreachDetection(): Promise<SlaBreachResult[]> {
  const results: SlaBreachResult[] = [];

  // 1. Clear stale breach flags on resolved/closed tickets
  await pool.query(
    `UPDATE tickets SET sla_breached = false, sla_breached_at = NULL
     WHERE sla_breached = true AND status IN ('resolved', 'closed')`
  );

  // 2. Find tickets with SLA policies that might be breached
  const tickets = await pool.query(
    `SELECT t.id, t.number, t.title, t.priority, t.created_at, t.due_date, sp.name as sla_policy_name
     FROM tickets t
     JOIN sla_policies sp ON t.sla_policy_id = sp.id
     WHERE t.status IN ('open', 'in_progress', 'waiting')
       AND t.sla_policy_id IS NOT NULL
       AND t.due_date IS NOT NULL
       AND (t.sla_breached = false OR t.sla_breached IS NULL)`
  );

  if (tickets.rows.length === 0) return results;

  const config = await loadBusinessHoursConfig();
  const now = new Date();

  for (const ticket of tickets.rows) {
    let isBreached = false;

    if (config.enabled && config.respect_for_sla) {
      const elapsedMs = await calculateBusinessHoursBetween(new Date(ticket.created_at), now);
      const policy = await findSlaPolicyForPriority(ticket.priority);
      if (policy) {
        isBreached = elapsedMs >= policy.resolution_time_hours * 3600000;
      }
    } else {
      isBreached = now > new Date(ticket.due_date);
    }

    if (isBreached) {
      await pool.query(
        `UPDATE tickets SET sla_breached = true, sla_breached_at = NOW() WHERE id = $1 AND sla_breached = false`,
        [ticket.id]
      );

      const hoursOverdue = config.enabled && config.respect_for_sla
        ? (await calculateBusinessHoursBetween(new Date(ticket.created_at), now)) / 3600000
        : (now.getTime() - new Date(ticket.due_date).getTime()) / 3600000;

      results.push({
        ticket_id: ticket.id,
        ticket_number: ticket.number,
        ticket_title: ticket.title,
        priority: ticket.priority,
        sla_policy_name: ticket.sla_policy_name,
        due_date: ticket.due_date,
        created_at: ticket.created_at,
        hours_overdue: Math.round(hoursOverdue * 100) / 100,
      });
    }
  }

  return results;
}

// ─── Stats & Reporting ──────────────────────────────────────────────────────

/**
 * Get SLA compliance statistics.
 */
export async function getSlaStats(
  dateFrom?: string,
  dateTo?: string
): Promise<SlaStats> {
  const dateWhere = dateFrom && dateTo
    ? 'AND t.created_at >= $1::timestamptz AND t.created_at <= $2::timestamptz'
    : '';
  const params: any[] = dateFrom && dateTo ? [dateFrom, dateTo] : [];

  const overall = await pool.query(
    `SELECT
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE t.sla_breached = true)::int as breached,
       COUNT(*) FILTER (WHERE t.sla_breached = false OR t.sla_breached IS NULL)::int as compliant,
       AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600)
         FILTER (WHERE t.first_response_at IS NOT NULL) as avg_response_hours,
       AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)
         FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours
     FROM tickets t
     WHERE t.sla_policy_id IS NOT NULL` +
     (dateWhere ? ' ' + dateWhere : ''),
    params
  );

  const row = overall.rows[0];
  const total = parseInt(row.total) || 0;
  const breached = parseInt(row.breached) || 0;

  const byPriority = await pool.query(
    `SELECT
       t.priority,
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE t.sla_breached = true)::int as breached
     FROM tickets t
     WHERE t.sla_policy_id IS NOT NULL` +
     (dateWhere ? ' ' + dateWhere : '') +
     ` GROUP BY t.priority ORDER BY t.priority`,
    params
  );

  return {
    total_tickets_with_sla: total,
    breached_count: breached,
    compliant_count: total - breached,
    compliance_rate: total > 0 ? Math.round(((total - breached) / total) * 10000) / 100 : 100,
    avg_response_time_hours: row.avg_response_hours
      ? Math.round(parseFloat(row.avg_response_hours) * 100) / 100
      : 0,
    avg_resolution_time_hours: row.avg_resolution_hours
      ? Math.round(parseFloat(row.avg_resolution_hours) * 100) / 100
      : 0,
    by_priority: byPriority.rows.map((r: any) => ({
      priority: r.priority,
      total: parseInt(r.total) || 0,
      breached: parseInt(r.breached) || 0,
      compliant: parseInt(r.total) - parseInt(r.breached),
      rate: parseInt(r.total) > 0
        ? Math.round(((parseInt(r.total) - parseInt(r.breached)) / parseInt(r.total)) * 10000) / 100
        : 100,
    })),
  };
}

/**
 * Get list of breached tickets.
 */
export async function getBreachedTickets(
  limit: number = 50,
  offset: number = 0,
  priority?: string
): Promise<{ tickets: any[]; total: number }> {
  let paramIdx = 1;
  const conditions: string[] = ['t.sla_breached = true'];
  const params: any[] = [];

  if (priority) {
    conditions.push(`t.priority = $${paramIdx++}`);
    params.push(priority);
  }

  const where = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*)::int as total FROM tickets t WHERE ${where}`,
    params
  );

  params.push(limit);
  params.push(offset);

  const tickets = await pool.query(
    `SELECT t.id, t.number, t.title, t.priority, t.status,
            t.created_at, t.due_date, t.first_response_at, t.resolved_at,
            t.sla_breached_at,
            sp.name as sla_policy_name,
            u.name as assigned_to_name
     FROM tickets t
     LEFT JOIN sla_policies sp ON t.sla_policy_id = sp.id
     LEFT JOIN users u ON t.assigned_to_id = u.id
     WHERE ${where}
     ORDER BY t.sla_breached_at DESC NULLS LAST, t.due_date ASC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  return {
    tickets: tickets.rows,
    total: countResult.rows[0].total,
  };
}