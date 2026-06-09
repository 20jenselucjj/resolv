import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { sendTemplateEmail } from '../services/outbound-email';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const reportTypeEnum = z.enum(['ticket_summary', 'agent_performance', 'sla_compliance', 'category_breakdown', 'custom', 'problem_summary', 'change_summary', 'approval_summary']);

const saveReportSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().nullable().optional(),
  report_type: reportTypeEnum,
  config: z.object({
    date_range: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      preset: z.enum(['7d', '30d', '90d', 'this_month', 'last_month', 'all']).optional(),
    }).optional().default({}),
    filters: z.object({
      status: z.array(z.string()).optional(),
      priority: z.array(z.string()).optional(),
      category_id: z.array(z.string()).optional(),
      assignee_id: z.array(z.string()).optional(),
      ticket_type: z.array(z.string()).optional(),
    }).optional().default({}),
    group_by: z.enum(['status', 'priority', 'type', 'category', 'assignee', 'day', 'week', 'month']).nullable().optional(),
    metrics: z.array(z.string()).optional(),
  }),
  is_public: z.boolean().optional().default(false),
});

const updateSavedReportSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  config: z.object({
    date_range: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      preset: z.enum(['7d', '30d', '90d', 'this_month', 'last_month', 'all']).optional(),
    }).optional(),
    filters: z.object({
      status: z.array(z.string()).optional(),
      priority: z.array(z.string()).optional(),
      category_id: z.array(z.string()).optional(),
      assignee_id: z.array(z.string()).optional(),
      ticket_type: z.array(z.string()).optional(),
    }).optional(),
    group_by: z.enum(['status', 'priority', 'type', 'category', 'assignee', 'day', 'week', 'month']).nullable().optional(),
    metrics: z.array(z.string()).optional(),
  }).optional(),
  is_public: z.boolean().optional(),
});

const executeReportSchema = z.object({
  report_type: reportTypeEnum,
  config: z.object({
    date_range: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      preset: z.enum(['7d', '30d', '90d', 'this_month', 'last_month', 'all']).optional(),
    }).optional().default({}),
    filters: z.object({
      status: z.array(z.string()).optional(),
      priority: z.array(z.string()).optional(),
      category_id: z.array(z.string()).optional(),
      assignee_id: z.array(z.string()).optional(),
      ticket_type: z.array(z.string()).optional(),
    }).optional().default({}),
    group_by: z.enum(['status', 'priority', 'type', 'category', 'assignee', 'day', 'week', 'month']).nullable().optional(),
    metrics: z.array(z.string()).optional(),
  }),
});

const scheduleSchema = z.object({
  report_id: z.string().uuid(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  day_of_week: z.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.number().int().min(1).max(31).optional().nullable(),
  hour: z.number().int().min(0).max(23).optional().default(8),
  recipients: z.array(z.string().email()).optional().default([]),
  format: z.enum(['email', 'csv', 'pdf']).optional().default('email'),
});

const updateScheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  day_of_week: z.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.number().int().min(1).max(31).optional().nullable(),
  hour: z.number().int().min(0).max(23).optional(),
  recipients: z.array(z.string().email()).optional(),
  format: z.enum(['email', 'csv', 'pdf']).optional(),
  is_active: z.boolean().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDateWhereClause(dateRange: any, tableAlias: string = 't', paramIdx: { current: number }, params: any[]): string {
  const preset = dateRange?.preset;
  const from = dateRange?.from;
  const to = dateRange?.to;

  if (from) {
    params.push(from);
    return ` AND ${tableAlias}.created_at >= $${paramIdx.current++}`;
  }
  if (to) {
    params.push(to);
    return ` AND ${tableAlias}.created_at <= $${paramIdx.current++}`;
  }
  if (preset && preset !== 'all') {
    const intervals: Record<string, string> = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      'this_month': '1 month',
      'last_month': '2 months',
    };
    const interval = intervals[preset] || '30 days';
    params.push(interval);
    if (preset === 'last_month') {
      return ` AND ${tableAlias}.created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND ${tableAlias}.created_at < date_trunc('month', NOW())`;
    }
    return ` AND ${tableAlias}.created_at >= NOW() - INTERVAL $${paramIdx.current++}`;
  }
  return '';
}

function buildFilterWhereClause(filters: any, tableAlias: string = 't', paramIdx: { current: number }, params: any[]): string {
  let sql = '';
  if (filters?.status?.length) {
    params.push(filters.status);
    sql += ` AND ${tableAlias}.status = ANY($${paramIdx.current++})`;
  }
  if (filters?.priority?.length) {
    params.push(filters.priority);
    sql += ` AND ${tableAlias}.priority = ANY($${paramIdx.current++})`;
  }
  if (filters?.category_id?.length) {
    params.push(filters.category_id);
    sql += ` AND ${tableAlias}.category_id = ANY($${paramIdx.current++})`;
  }
  if (filters?.assignee_id?.length) {
    params.push(filters.assignee_id);
    sql += ` AND ${tableAlias}.assigned_to_id = ANY($${paramIdx.current++})`;
  }
  if (filters?.ticket_type?.length) {
    params.push(filters.ticket_type);
    sql += ` AND ${tableAlias}.ticket_type = ANY($${paramIdx.current++})`;
  }
  return sql;
}

function buildGroupBy(groupBy: string | null | undefined, dateTruncSuffix?: string): { groupClause: string; selectClause: string } {
  if (!groupBy) return { groupClause: '', selectClause: '' };

  switch (groupBy) {
    case 'status':
      return { groupClause: 'GROUP BY t.status', selectClause: 't.status as group_key,' };
    case 'priority':
      return { groupClause: 'GROUP BY t.priority', selectClause: 't.priority as group_key,' };
    case 'type':
      return { groupClause: 'GROUP BY t.ticket_type', selectClause: 't.ticket_type as group_key,' };
    case 'category':
      return { groupClause: 'GROUP BY c.name', selectClause: 'COALESCE(c.name, \'Uncategorized\') as group_key,' };
    case 'assignee':
      return { groupClause: 'GROUP BY u.name', selectClause: 'COALESCE(u.name, \'Unassigned\') as group_key,' };
    case 'day':
      return { groupClause: `GROUP BY date_trunc('day', t.created_at)`, selectClause: `date_trunc('day', t.created_at)::text as group_key,` };
    case 'week':
      return { groupClause: `GROUP BY date_trunc('week', t.created_at)`, selectClause: `date_trunc('week', t.created_at)::text as group_key,` };
    case 'month':
      return { groupClause: `GROUP BY date_trunc('month', t.created_at)`, selectClause: `date_trunc('month', t.created_at)::text as group_key,` };
    default:
      return { groupClause: '', selectClause: '' };
  }
}

export function calculateNextRun(schedule: { frequency: string; day_of_week?: number | null; day_of_month?: number | null; hour: number }): Date {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  switch (schedule.frequency) {
    case 'daily': {
      next.setHours(schedule.hour, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    }
    case 'weekly': {
      const targetDay = schedule.day_of_week ?? 1; // default Monday
      next.setHours(schedule.hour, 0, 0, 0);
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    }
    case 'monthly': {
      const targetDay = schedule.day_of_month ?? 1;
      next.setHours(schedule.hour, 0, 0, 0);
      next.setDate(targetDay);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        // Handle month overflow (e.g. Jan 31 -> Feb 28)
        if (next.getDate() !== targetDay) {
          next.setDate(0); // Go to last day of previous month
        }
      }
      break;
    }
  }
  return next;
}

// ─── CSV Escaping ────────────────────────────────────────────────────────────

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(h => escapeCSV(h)).join(',');
  const dataLines = rows.map(row => row.map(cell => escapeCSV(cell)).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// ─── Report Execution Engine ─────────────────────────────────────────────────

async function executeTicketSummary(config: any): Promise<{ data: any; summary: any }> {
  const paramIdx = { current: 1 };
  const params: any[] = [];

  const dateWhere = buildDateWhereClause(config.date_range, 't', paramIdx, params);
  const filterWhere = buildFilterWhereClause(config.filters, 't', paramIdx, params);

  // Total by status
  const byStatus = await pool.query(
    `SELECT t.status, COUNT(*) as count
     FROM tickets t
     WHERE 1=1${dateWhere}${filterWhere}
     GROUP BY t.status ORDER BY t.status`,
    params
  );

  // Total by priority
  const byPriority = await pool.query(
    `SELECT t.priority, COUNT(*) as count
     FROM tickets t
     WHERE 1=1${dateWhere}${filterWhere}
     GROUP BY t.priority ORDER BY t.priority`,
    params
  );

  // Total by type
  const byType = await pool.query(
    `SELECT t.ticket_type, COUNT(*) as count
     FROM tickets t
     WHERE 1=1${dateWhere}${filterWhere}
     GROUP BY t.ticket_type ORDER BY t.ticket_type`,
    params
  );

  // First response time average
  const responseTime = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600) as avg_response_hours
     FROM tickets t
     WHERE t.first_response_at IS NOT NULL${dateWhere}${filterWhere}`,
    params
  );

  // Resolution time average
  const resolutionTime = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) as avg_resolution_hours
     FROM tickets t
     WHERE t.resolved_at IS NOT NULL${dateWhere}${filterWhere}`,
    params
  );

  // First contact resolution rate
  const fcr = await pool.query(
    `SELECT
       COUNT(*) as total_resolved,
       COUNT(*) FILTER (WHERE t.first_response_at IS NOT NULL AND t.resolved_at IS NOT NULL AND t.first_response_at = t.resolved_at) as first_contact_resolved
     FROM tickets t
     WHERE t.resolved_at IS NOT NULL${dateWhere}${filterWhere}`,
    params
  );

  // Ticket volume trend (daily)
  const p2 = [...params];
  const pIdx2 = { current: paramIdx.current };
  const trend = await pool.query(
    `SELECT date_trunc('day', t.created_at)::text as date, COUNT(*) as count
     FROM tickets t
     WHERE 1=1${dateWhere}${filterWhere}
     GROUP BY date_trunc('day', t.created_at)
     ORDER BY date_trunc('day', t.created_at)`,
    params
  );

  const total = byStatus.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0);
  const avgResponseHours = parseFloat(responseTime.rows[0]?.avg_response_hours) || 0;
  const avgResolutionHours = parseFloat(resolutionTime.rows[0]?.avg_resolution_hours) || 0;
  const fcrRow = fcr.rows[0];
  const fcrRate = fcrRow ? (parseInt(fcrRow.total_resolved) > 0
    ? Math.round((parseInt(fcrRow.first_contact_resolved) / parseInt(fcrRow.total_resolved)) * 100)
    : 0) : 0;

  return {
    data: {
      by_status: byStatus.rows,
      by_priority: byPriority.rows,
      by_type: byType.rows,
      trend: trend.rows,
    },
    summary: {
      total,
      avg_response_hours: Math.round(avgResponseHours * 100) / 100,
      avg_resolution_hours: Math.round(avgResolutionHours * 100) / 100,
      avg_response_formatted: avgResponseHours < 1
        ? `${Math.round(avgResponseHours * 60)}m`
        : `${avgResponseHours.toFixed(1)}h`,
      avg_resolution_formatted: avgResolutionHours < 24
        ? `${avgResolutionHours.toFixed(1)}h`
        : `${(avgResolutionHours / 24).toFixed(1)}d`,
      first_contact_resolution_rate: fcrRate,
    },
  };
}

async function executeAgentPerformance(config: any): Promise<{ data: any[]; summary: any }> {
  const paramIdx = { current: 1 };
  const params: any[] = [];

  const dateWhere = buildDateWhereClause(config.date_range, 't', paramIdx, params);
  const filterWhere = buildFilterWhereClause(config.filters, 't', paramIdx, params);

  const result = await pool.query(
    `SELECT
       u.id as agent_id,
       u.name as agent_name,
       u.email as agent_email,
       COUNT(DISTINCT t.id) as tickets_assigned,
       COUNT(DISTINCT t.id) FILTER (WHERE t.resolved_at IS NOT NULL) as tickets_resolved,
       COUNT(DISTINCT t.id) FILTER (WHERE t.sla_breached = true) as sla_breaches,
       AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600) FILTER (WHERE t.first_response_at IS NOT NULL) as avg_response_hours,
       AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours,
       AVG(t.satisfaction_rating) FILTER (WHERE t.satisfaction_rating IS NOT NULL) as csat_avg
     FROM users u
     JOIN tickets t ON t.assigned_to_id = u.id
     WHERE u.role IN ('admin', 'agent') AND u.is_active = true${dateWhere}${filterWhere}
     GROUP BY u.id, u.name, u.email
     ORDER BY tickets_resolved DESC`,
    params
  );

  const rows = result.rows.map((r: any) => ({
    ...r,
    tickets_assigned: parseInt(r.tickets_assigned),
    tickets_resolved: parseInt(r.tickets_resolved),
    sla_breaches: parseInt(r.sla_breaches),
    avg_response_hours: parseFloat(r.avg_response_hours) || 0,
    avg_resolution_hours: parseFloat(r.avg_resolution_hours) || 0,
    csat_avg: r.csat_avg ? parseFloat(r.csat_avg) : null,
  }));

  const totalAssigned = rows.reduce((s: number, r: any) => s + r.tickets_assigned, 0);
  const totalResolved = rows.reduce((s: number, r: any) => s + r.tickets_resolved, 0);

  return {
    data: rows,
    summary: {
      total_agents: rows.length,
      total_assigned: totalAssigned,
      total_resolved: totalResolved,
      avg_resolution_rate: totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 0,
    },
  };
}

async function executeSlaCompliance(config: any): Promise<{ data: any; summary: any }> {
  const paramIdx = { current: 1 };
  const params: any[] = [];

  const dateWhere = buildDateWhereClause(config.date_range, 't', paramIdx, params);
  const filterWhere = buildFilterWhereClause(config.filters, 't', paramIdx, params);

  // SLA met vs breached
  const total = await pool.query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE t.sla_breached = true) as breached,
       COUNT(*) FILTER (WHERE t.sla_breached = false OR t.sla_breached IS NULL) as met
     FROM tickets t
     WHERE 1=1${dateWhere}${filterWhere}`,
    params
  );

  // By priority
  const byPriority = await pool.query(
    `SELECT
       t.priority,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE t.sla_breached = true) as breached
     FROM tickets t
     WHERE 1=1${dateWhere}${filterWhere}
     GROUP BY t.priority ORDER BY t.priority`,
    params
  );

  // Average time to breach (hours until SLA breached)
  const avgTimeToBreach = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (t.sla_breached_at - t.created_at))/3600) as avg_hours_to_breach
     FROM tickets t
     WHERE t.sla_breached = true${dateWhere}${filterWhere}`,
    params
  );

  // At-risk tickets (approaching SLA but not yet breached)
  const atRisk = await pool.query(
    `SELECT t.id, t.number, t.title, t.priority, t.due_date, t.assigned_to_id,
            u.name as assigned_to_name,
            EXTRACT(EPOCH FROM (t.due_date - NOW()))/3600 as hours_remaining
     FROM tickets t
     LEFT JOIN users u ON t.assigned_to_id = u.id
     WHERE t.status NOT IN ('resolved', 'closed')
     AND t.due_date IS NOT NULL
     AND t.due_date > NOW()
     AND t.due_date <= NOW() + INTERVAL '4 hours'
     AND (t.sla_breached = false OR t.sla_breached IS NULL)${dateWhere}${filterWhere}
     ORDER BY t.due_date ASC
     LIMIT 50`,
    params
  );

  const totalRow = total.rows[0];
  const totalCount = parseInt(totalRow.total);
  const breachedCount = parseInt(totalRow.breached);
  const complianceRate = totalCount > 0 ? Math.round(((totalCount - breachedCount) / totalCount) * 100) : 100;

  return {
    data: {
      by_priority: byPriority.rows.map((r: any) => ({
        priority: r.priority,
        total: parseInt(r.total),
        breached: parseInt(r.breached),
        compliance_pct: parseInt(r.total) > 0
          ? Math.round(((parseInt(r.total) - parseInt(r.breached)) / parseInt(r.total)) * 100)
          : 100,
      })),
      at_risk: atRisk.rows.map((r: any) => ({
        ...r,
        hours_remaining: r.hours_remaining ? Math.round(parseFloat(r.hours_remaining) * 10) / 10 : null,
      })),
    },
    summary: {
      total: totalCount,
      breached: breachedCount,
      met: totalCount - breachedCount,
      compliance_pct: complianceRate,
      avg_hours_to_breach: avgTimeToBreach.rows[0]?.avg_hours_to_breach
        ? Math.round(parseFloat(avgTimeToBreach.rows[0].avg_hours_to_breach) * 10) / 10
        : null,
      at_risk_count: atRisk.rows.length,
    },
  };
}

async function executeCategoryBreakdown(config: any): Promise<{ data: any[]; summary: any }> {
  const paramIdx = { current: 1 };
  const params: any[] = [];

  const dateWhere = buildDateWhereClause(config.date_range, 't', paramIdx, params);
  const filterWhere = buildFilterWhereClause(config.filters, 't', paramIdx, params);

  // Include left join so tickets without categories still show up
  const result = await pool.query(
    `SELECT
       COALESCE(c.name, 'Uncategorized') as category_name,
       c.id as category_id,
       COUNT(*) as ticket_count,
       AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours
     FROM tickets t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE 1=1${dateWhere}${filterWhere}
     GROUP BY c.name, c.id
     ORDER BY ticket_count DESC`,
    params
  );

  const rows = result.rows.map((r: any) => ({
    category_name: r.category_name,
    category_id: r.category_id,
    ticket_count: parseInt(r.ticket_count),
    avg_resolution_hours: r.avg_resolution_hours ? Math.round(parseFloat(r.avg_resolution_hours) * 100) / 100 : null,
  }));

  const totalTickets = rows.reduce((s: number, r: any) => s + r.ticket_count, 0);

  return {
    data: rows,
    summary: {
      total_categories: rows.length,
      total_tickets: totalTickets,
      top_category: rows[0]?.category_name || 'N/A',
      top_category_pct: rows[0] ? Math.round((rows[0].ticket_count / totalTickets) * 100) : 0,
    },
  };
}

async function executeCustom(config: any): Promise<{ data: any[]; summary: any }> {
  const metrics = config.metrics || ['ticket_count'];
  const groupBy = config.group_by || 'status';
  const paramIdx = { current: 1 };
  const params: any[] = [];

  const dateWhere = buildDateWhereClause(config.date_range, 't', paramIdx, params);
  const filterWhere = buildFilterWhereClause(config.filters, 't', paramIdx, params);

  // Build metric select expressions
  const metricSelects: string[] = [];
  const metricLabels: string[] = [];

  for (const metric of metrics) {
    switch (metric) {
      case 'ticket_count':
        metricSelects.push('COUNT(*) as ticket_count');
        metricLabels.push('ticket_count');
        break;
      case 'avg_response_time':
        metricSelects.push('AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600) FILTER (WHERE t.first_response_at IS NOT NULL) as avg_response_hours');
        metricLabels.push('avg_response_hours');
        break;
      case 'avg_resolution_time':
        metricSelects.push('AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours');
        metricLabels.push('avg_resolution_hours');
        break;
      case 'fcr_rate':
        metricSelects.push('COUNT(*) FILTER (WHERE t.first_response_at IS NOT NULL AND t.resolved_at IS NOT NULL AND t.first_response_at = t.resolved_at) as fcr_count');
        metricSelects.push('COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL) as resolved_count');
        metricLabels.push('fcr_count', 'resolved_count');
        break;
      case 'sla_compliance':
        metricSelects.push('COUNT(*) FILTER (WHERE t.sla_breached = true) as sla_breaches');
        metricSelects.push('COUNT(*) as total_count');
        metricLabels.push('sla_breaches', 'total_count');
        break;
      case 'csat_avg':
        metricSelects.push('AVG(t.satisfaction_rating) FILTER (WHERE t.satisfaction_rating IS NOT NULL) as csat_avg');
        metricLabels.push('csat_avg');
        break;
    }
  }

  if (metricSelects.length === 0) {
    metricSelects.push('COUNT(*) as ticket_count');
    metricLabels.push('ticket_count');
  }

  const groupByInfo = buildGroupBy(groupBy);

  // Extra joins for group by
  let joins = '';
  if (groupBy === 'category') joins = ' LEFT JOIN categories c ON t.category_id = c.id';
  if (groupBy === 'assignee') joins = ' LEFT JOIN users u ON t.assigned_to_id = u.id';

  const selectExpr = metricSelects.join(',\n       ');

  const result = await pool.query(
    `SELECT
       ${groupByInfo.selectClause}
       ${selectExpr}
     FROM tickets t${joins}
     WHERE 1=1${dateWhere}${filterWhere}
     ${groupByInfo.groupClause}
     ORDER BY ticket_count DESC`,
    params
  );

  return {
    data: result.rows,
    summary: {
      metrics_used: metricLabels,
      group_by: groupBy,
      row_count: result.rows.length,
    },
  };
}

export async function executeReport(reportType: string, config: any): Promise<{ data: any; summary: any; report_type: string }> {
  switch (reportType) {
    case 'ticket_summary':
      return { ...(await executeTicketSummary(config)), report_type: 'ticket_summary' };
    case 'agent_performance':
      return { ...(await executeAgentPerformance(config)), report_type: 'agent_performance' };
    case 'sla_compliance':
      return { ...(await executeSlaCompliance(config)), report_type: 'sla_compliance' };
    case 'category_breakdown':
      return { ...(await executeCategoryBreakdown(config)), report_type: 'category_breakdown' };
    case 'custom':
      return { ...(await executeCustom(config)), report_type: 'custom' };
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

// ─── CSV Generation ──────────────────────────────────────────────────────────

export function reportToCsv(reportType: string, result: any): string {
  switch (reportType) {
    case 'ticket_summary': {
      const lines: string[] = [];
      const s = result.summary;
      lines.push(`Report:,Ticket Summary`);
      lines.push(`Total Tickets:,${s.total}`);
      lines.push(`Avg Response:,${s.avg_response_formatted}`);
      lines.push(`Avg Resolution:,${s.avg_resolution_formatted}`);
      lines.push(`FCR Rate:,${s.first_contact_resolution_rate}%`);
      lines.push('');
      lines.push(toCSV(['Status', 'Count'], result.data.by_status.map((r: any) => [r.status, r.count])));
      lines.push('');
      lines.push(toCSV(['Priority', 'Count'], result.data.by_priority.map((r: any) => [r.priority, r.count])));
      lines.push('');
      lines.push(toCSV(['Type', 'Count'], result.data.by_type.map((r: any) => [r.ticket_type, r.count])));
      return lines.join('\n');
    }
    case 'agent_performance': {
      const lines: string[] = [];
      const s = result.summary;
      lines.push(`Report:,Agent Performance`);
      lines.push(`Total Agents:,${s.total_agents}`);
      lines.push(`Total Assigned:,${s.total_assigned}`);
      lines.push(`Total Resolved:,${s.total_resolved}`);
      lines.push('');
      lines.push(toCSV(
        ['Agent', 'Assigned', 'Resolved', 'SLA Breaches', 'Avg Response (h)', 'Avg Resolution (h)', 'CSAT'],
        result.data.map((r: any) => [r.agent_name, r.tickets_assigned, r.tickets_resolved, r.sla_breaches, r.avg_response_hours?.toFixed(1), r.avg_resolution_hours?.toFixed(1), r.csat_avg?.toFixed(1) || ''])
      ));
      return lines.join('\n');
    }
    case 'sla_compliance': {
      const lines: string[] = [];
      const s = result.summary;
      lines.push(`Report:,SLA Compliance`);
      lines.push(`Total Tickets:,${s.total}`);
      lines.push(`SLA Met:,${s.met}`);
      lines.push(`SLA Breached:,${s.breached}`);
      lines.push(`Compliance:,${s.compliance_pct}%`);
      lines.push('');
      lines.push(toCSV(
        ['Priority', 'Total', 'Breached', 'Compliance %'],
        result.data.by_priority.map((r: any) => [r.priority, r.total, r.breached, `${r.compliance_pct}%`])
      ));
      if (result.data.at_risk?.length) {
        lines.push('');
        lines.push(toCSV(
          ['#', 'Title', 'Priority', 'Assignee', 'Hours Remaining'],
          result.data.at_risk.map((r: any) => [r.number, r.title, r.priority, r.assigned_to_name || 'Unassigned', r.hours_remaining])
        ));
      }
      return lines.join('\n');
    }
    case 'category_breakdown': {
      const lines: string[] = [];
      const s = result.summary;
      lines.push(`Report:,Category Breakdown`);
      lines.push(`Total Categories:,${s.total_categories}`);
      lines.push(`Total Tickets:,${s.total_tickets}`);
      lines.push(`Top Category:,${s.top_category}`);
      lines.push('');
      lines.push(toCSV(
        ['Category', 'Ticket Count', 'Avg Resolution (h)'],
        result.data.map((r: any) => [r.category_name, r.ticket_count, r.avg_resolution_hours?.toFixed(1) || ''])
      ));
      return lines.join('\n');
    }
    default:
      return toCSV(Object.keys(result.data[0] || {}), result.data.map((r: any) => Object.values(r)));
  }
}

// ─── HTML Report Generation ──────────────────────────────────────────────────

export function reportToHtml(reportType: string, result: any): string {
  const s = result.summary;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report: ${reportType.replace(/_/g, ' ')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; }
  h1 { font-size: 24px; border-bottom: 2px solid #4361ee; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 28px; color: #4361ee; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  th { background: #f1f5f9; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 800; color: #4361ee; }
  .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  @media print { body { margin: 20px; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="no-print" style="margin-bottom:16px;">
  <button onclick="window.print()" style="padding:8px 20px;background:#4361ee;color:white;border:none;border-radius:6px;cursor:pointer;">Print / Save PDF</button>
</div>
<h1>${reportType.replace(/_/g, ' ')} Report</h1>
<p style="color:#64748b;font-size:13px;">Generated: ${new Date().toLocaleString()}</p>`;

  // Summary stats
  if (s) {
    html += '<div class="summary">';
    for (const [key, val] of Object.entries(s)) {
      if (typeof val === 'number' || typeof val === 'string') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        html += `<div class="stat"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`;
      }
    }
    html += '</div>';
  }

  // Tables for each data array
  if (result.data) {
    for (const [key, rows] of Object.entries(result.data)) {
      if (Array.isArray(rows) && rows.length > 0) {
        const headers = Object.keys(rows[0]);
        html += `<h2>${key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</h2>`;
        html += '<table><thead><tr>';
        for (const h of headers) {
          html += `<th>${h.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (const row of rows) {
          html += '<tr>';
          for (const h of headers) {
            html += `<td>${row[h] ?? ''}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
      }
    }
  }

  html += '</body></html>';
  return html;
}

// ─── Route Registration ─────────────────────────────────────────────────────

export default async function advancedReportRoutes(fastify: FastifyInstance) {
  // ─── Saved Reports ─────────────────────────────────────────────────────────

  // GET /reports/saved — List saved reports
  fastify.get('/reports/saved', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const user = request.user;
    const isAdmin = user.role === 'admin';

    const whereClause = isAdmin ? '1=1' : '(sr.created_by = $1 OR sr.is_public = true)';
    const params = isAdmin ? [] : [user.id];
    const result = await pool.query(
      `SELECT sr.*, u.name as created_by_name
       FROM saved_reports sr
       JOIN users u ON sr.created_by = u.id
       WHERE ${whereClause}
       ORDER BY sr.updated_at DESC`,
      params
    );

    return reply.send({ data: result.rows });
  });

  // POST /reports/saved — Save a report configuration
  fastify.post('/reports/saved', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const body = saveReportSchema.parse(request.body);
    const user = request.user;

    const result = await pool.query(
      `INSERT INTO saved_reports (name, description, report_type, config, created_by, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.name,
        body.description ?? null,
        body.report_type,
        JSON.stringify(body.config),
        user.id,
        body.is_public,
      ]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [user.id, 'create_saved_report', 'saved_reports', result.rows[0].id, JSON.stringify({ name: body.name, report_type: body.report_type })]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /reports/saved/:id — Update saved report
  fastify.patch('/reports/saved/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSavedReportSchema.parse(request.body);
    const user = request.user;

    // Check ownership or admin
    const existing = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Saved report not found' });
    }
    if (existing.rows[0].created_by !== user.id && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 2;

    if (body.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(body.name); }
    if (body.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(body.description); }
    if (body.config !== undefined) { fields.push(`config = $${paramIdx++}`); values.push(JSON.stringify(body.config)); }
    if (body.is_public !== undefined) { fields.push(`is_public = $${paramIdx++}`); values.push(body.is_public); }

    if (fields.length === 0) {
      return reply.send({ data: existing.rows[0] });
    }

    const result = await pool.query(
      `UPDATE saved_reports SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /reports/saved/:id — Delete saved report
  fastify.delete('/reports/saved/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const existing = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Saved report not found' });
    }
    if (existing.rows[0].created_by !== user.id && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await pool.query('DELETE FROM saved_reports WHERE id = $1', [id]);

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [user.id, 'delete_saved_report', 'saved_reports', id, JSON.stringify({ name: existing.rows[0].name })]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

  // ─── Report Execution ──────────────────────────────────────────────────────

  // POST /reports/execute — Execute a report with inline config
  fastify.post('/reports/execute', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const body = executeReportSchema.parse(request.body);
    const user = request.user;

    // Log execution start
    const logResult = await pool.query(
      `INSERT INTO report_execution_log (report_id, status, executed_by)
       VALUES ($1, 'running', $2) RETURNING *`,
      [null, user.id]
    );
    const logId = logResult.rows[0].id;

    try {
      const result = await executeReport(body.report_type, body.config);

      await pool.query(
        `UPDATE report_execution_log SET status = 'completed', completed_at = NOW(), row_count = $1 WHERE id = $2`,
        [Array.isArray(result.data) ? result.data.length : 1, logId]
      );

      return reply.send({
        data: result.data,
        summary: result.summary,
        report_type: result.report_type,
      });
    } catch (err: any) {
      await pool.query(
        `UPDATE report_execution_log SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message, logId]
      );
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /reports/execute/:savedId — Execute a saved report by ID
  fastify.get('/reports/execute/:savedId', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const { savedId } = request.params as { savedId: string };
    const user = request.user;

    const saved = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [savedId]);
    if (saved.rows.length === 0) {
      return reply.status(404).send({ error: 'Saved report not found' });
    }

    const savedReport = saved.rows[0];

    // Log execution
    const logResult = await pool.query(
      `INSERT INTO report_execution_log (report_id, status, executed_by)
       VALUES ($1, 'running', $2) RETURNING *`,
      [savedId, user.id]
    );
    const logId = logResult.rows[0].id;

    try {
      const config = typeof savedReport.config === 'string' ? JSON.parse(savedReport.config) : savedReport.config;
      const result = await executeReport(savedReport.report_type, config);

      await pool.query(
        `UPDATE report_execution_log SET status = 'completed', completed_at = NOW(), row_count = $1 WHERE id = $2`,
        [Array.isArray(result.data) ? result.data.length : 1, logId]
      );

      await pool.query(
        'UPDATE saved_reports SET updated_at = NOW() WHERE id = $1',
        [savedId]
      );

      return reply.send({
        data: result.data,
        summary: result.summary,
        report_type: result.report_type,
        saved_report: savedReport,
      });
    } catch (err: any) {
      await pool.query(
        `UPDATE report_execution_log SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message, logId]
      );
      return reply.status(500).send({ error: err.message });
    }
  });

  // ─── Export ────────────────────────────────────────────────────────────────

  // GET /reports/export/:savedId — Export report as CSV or PDF
  fastify.get('/reports/export/:savedId', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const { savedId } = request.params as { savedId: string };
    const query = request.query as { format?: string };
    const format = query.format || 'csv';
    const user = request.user;

    const saved = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [savedId]);
    if (saved.rows.length === 0) {
      return reply.status(404).send({ error: 'Saved report not found' });
    }

    const savedReport = saved.rows[0];
    const config = typeof savedReport.config === 'string' ? JSON.parse(savedReport.config) : savedReport.config;

    // Log execution
    const logResult = await pool.query(
      `INSERT INTO report_execution_log (report_id, status, format, executed_by)
       VALUES ($1, 'running', $2, $3) RETURNING *`,
      [savedId, format, user.id]
    );
    const logId = logResult.rows[0].id;

    try {
      const result = await executeReport(savedReport.report_type, config);

      await pool.query(
        `UPDATE report_execution_log SET status = 'completed', completed_at = NOW(), row_count = $1 WHERE id = $2`,
        [Array.isArray(result.data) ? result.data.length : 1, logId]
      );

      if (format === 'csv') {
        const csv = reportToCsv(savedReport.report_type, result);
        const filename = `${savedReport.name.replace(/[^a-z0-9]/gi, '_')}.csv`;

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        return reply.send(csv);
      }

      // PDF or HTML format
      const html = reportToHtml(savedReport.report_type, result);

      if (format === 'pdf') {
        // Return HTML with print instruction — browser can print to PDF
        reply.header('Content-Type', 'text/html; charset=utf-8');
        return reply.send(html);
      }

      // Default: HTML format
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.send(html);
    } catch (err: any) {
      await pool.query(
        `UPDATE report_execution_log SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message, logId]
      );
      return reply.status(500).send({ error: err.message });
    }
  });

  // ─── Schedules ─────────────────────────────────────────────────────────────

  // GET /reports/schedules — List report schedules (admin)
  fastify.get('/reports/schedules', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const result = await pool.query(
      `SELECT rs.*, sr.name as report_name, sr.report_type,
              u.name as created_by_name
       FROM report_schedules rs
       JOIN saved_reports sr ON rs.report_id = sr.id
       LEFT JOIN users u ON rs.created_by = u.id
       ORDER BY rs.next_run_at ASC NULLS LAST`
    );

    return reply.send({ data: result.rows });
  });

  // POST /reports/schedules — Create schedule (admin)
  fastify.post('/reports/schedules', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const body = scheduleSchema.parse(request.body);
    const user = request.user;

    // Validate report exists
    const report = await pool.query('SELECT id FROM saved_reports WHERE id = $1', [body.report_id]);
    if (report.rows.length === 0) {
      return reply.status(404).send({ error: 'Saved report not found' });
    }

    // Calculate next run
    const nextRun = calculateNextRun(body);

    const result = await pool.query(
      `INSERT INTO report_schedules (report_id, frequency, day_of_week, day_of_month, hour, recipients, format, next_run_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        body.report_id,
        body.frequency,
        body.day_of_week ?? null,
        body.day_of_month ?? null,
        body.hour,
        body.recipients,
        body.format,
        nextRun,
        user.id,
      ]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [user.id, 'create_report_schedule', 'report_schedules', result.rows[0].id, JSON.stringify({ report_id: body.report_id, frequency: body.frequency })]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /reports/schedules/:id — Update schedule (admin)
  fastify.patch('/reports/schedules/:id', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateScheduleSchema.parse(request.body);

    const existing = await pool.query('SELECT * FROM report_schedules WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 2;

    if (body.frequency !== undefined) { fields.push(`frequency = $${paramIdx++}`); values.push(body.frequency); }
    if (body.day_of_week !== undefined) { fields.push(`day_of_week = $${paramIdx++}`); values.push(body.day_of_week); }
    if (body.day_of_month !== undefined) { fields.push(`day_of_month = $${paramIdx++}`); values.push(body.day_of_month); }
    if (body.hour !== undefined) { fields.push(`hour = $${paramIdx++}`); values.push(body.hour); }
    if (body.recipients !== undefined) { fields.push(`recipients = $${paramIdx++}`); values.push(body.recipients); }
    if (body.format !== undefined) { fields.push(`format = $${paramIdx++}`); values.push(body.format); }
    if (body.is_active !== undefined) { fields.push(`is_active = $${paramIdx++}`); values.push(body.is_active); }

    if (body.frequency !== undefined || body.day_of_week !== undefined || body.day_of_month !== undefined || body.hour !== undefined) {
      // Recalculate next_run_at
      const updated = { ...existing.rows[0], ...body };
      const nextRun = calculateNextRun(updated);
      fields.push(`next_run_at = $${paramIdx++}`);
      values.push(nextRun);
    }

    if (fields.length === 0) {
      return reply.send({ data: existing.rows[0] });
    }

    const result = await pool.query(
      `UPDATE report_schedules SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /reports/schedules/:id — Delete schedule (admin)
  fastify.delete('/reports/schedules/:id', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await pool.query('SELECT * FROM report_schedules WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    await pool.query('DELETE FROM report_schedules WHERE id = $1', [id]);

    return reply.send({ success: true });
  });

  // POST /reports/schedules/:id/run — Force run a scheduled report (admin)
  fastify.post('/reports/schedules/:id/run', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const schedule = await pool.query('SELECT * FROM report_schedules WHERE id = $1', [id]);
    if (schedule.rows.length === 0) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    const savedReport = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [schedule.rows[0].report_id]);
    if (savedReport.rows.length === 0) {
      return reply.status(404).send({ error: 'Saved report not found' });
    }

    const savedReportData = savedReport.rows[0];
    const config = typeof savedReportData.config === 'string' ? JSON.parse(savedReportData.config) : savedReportData.config;

    // Log execution
    const logResult = await pool.query(
      `INSERT INTO report_execution_log (report_id, schedule_id, status, format, executed_by)
       VALUES ($1, $2, 'running', $3, $4) RETURNING *`,
      [schedule.rows[0].report_id, id, schedule.rows[0].format, user.id]
    );
    const logId = logResult.rows[0].id;

    try {
      const result = await executeReport(savedReportData.report_type, config);

      // If format is email, send the report via email
      if (schedule.rows[0].format === 'email' || schedule.rows[0].format === 'csv') {
        const recipients = schedule.rows[0].recipients || [];
        for (const recipient of recipients) {
          sendTemplateEmail(
            recipient,
            '',
            'Scheduled Report',
            {
              report_name: savedReportData.name,
              report_type: savedReportData.report_type,
              generated_at: new Date().toLocaleString(),
            },
            undefined
          ).catch((err: Error) => console.error(`[reports] Failed to send scheduled report email to ${recipient}:`, err.message));
        }
      }

      // Update schedule last_run_at and next_run_at
      const nextRun = calculateNextRun(schedule.rows[0]);
      await pool.query(
        `UPDATE report_schedules SET last_run_at = NOW(), next_run_at = $1 WHERE id = $2`,
        [nextRun, id]
      );

      await pool.query(
        `UPDATE report_execution_log SET status = 'completed', completed_at = NOW(), row_count = $1 WHERE id = $2`,
        [Array.isArray(result.data) ? result.data.length : 1, logId]
      );

      return reply.send({
        success: true,
        data: result.data,
        summary: result.summary,
      });
    } catch (err: any) {
      await pool.query(
        `UPDATE report_execution_log SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message, logId]
      );
      return reply.status(500).send({ error: err.message });
    }
  });

  // ─── Report Metrics Schema ─────────────────────────────────────────────────

  // GET /reports/metrics — Available metrics and dimensions for the builder
  fastify.get('/reports/metrics', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const metrics = [
      { key: 'ticket_count', label: 'Ticket Count', type: 'count', description: 'Total number of tickets' },
      { key: 'avg_response_time', label: 'Avg Response Time', type: 'duration', description: 'Average time to first response (hours)' },
      { key: 'avg_resolution_time', label: 'Avg Resolution Time', type: 'duration', description: 'Average time to resolution (hours)' },
      { key: 'fcr_rate', label: 'FCR Rate', type: 'percentage', description: 'First contact resolution rate' },
      { key: 'sla_compliance', label: 'SLA Compliance %', type: 'percentage', description: 'Percentage of tickets meeting SLA' },
      { key: 'csat_avg', label: 'CSAT Average', type: 'rating', description: 'Average customer satisfaction rating (1-5)' },
      // Problem metrics
      { key: 'problem_count', label: 'Problem Count', type: 'number', description: 'Total number of problems' },
      { key: 'mttr', label: 'Mean Time to Resolve', type: 'number', description: 'Average hours to resolve problems' },
      { key: 'incident_link_rate', label: 'Incident Link Rate', type: 'percentage', description: 'Percentage of problems with linked incidents' },
      // Change metrics
      { key: 'change_count', label: 'Change Count', type: 'number', description: 'Total number of changes' },
      { key: 'change_success_rate', label: 'Change Success Rate', type: 'percentage', description: 'Percentage of successful changes' },
      { key: 'change_rollback_rate', label: 'Rollback Rate', type: 'percentage', description: 'Percentage of rolled back changes' },
      // Approval metrics
      { key: 'approval_count', label: 'Approval Count', type: 'number', description: 'Total approval requests' },
      { key: 'avg_decision_time', label: 'Avg Decision Time', type: 'number', description: 'Average hours to decide' },
      { key: 'approval_rate', label: 'Approval Rate', type: 'percentage', description: 'Percentage approved' },
    ];

    const dimensions = [
      { key: 'status', label: 'Status', type: 'categorical' },
      { key: 'priority', label: 'Priority', type: 'categorical' },
      { key: 'type', label: 'Ticket Type', type: 'categorical' },
      { key: 'category', label: 'Category', type: 'categorical' },
      { key: 'assignee', label: 'Assignee', type: 'categorical' },
      { key: 'day', label: 'Day', type: 'time' },
      { key: 'week', label: 'Week', type: 'time' },
      { key: 'month', label: 'Month', type: 'time' },
      { key: 'problem_status', label: 'Problem Status', type: 'string' },
      { key: 'change_type', label: 'Change Type', type: 'string' },
      { key: 'change_risk', label: 'Risk Level', type: 'string' },
      { key: 'approval_status', label: 'Approval Status', type: 'string' },
      { key: 'entity_type', label: 'Entity Type', type: 'string' },
    ];

    const filters = [
      { key: 'status', label: 'Status', type: 'multiselect', options: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
      { key: 'priority', label: 'Priority', type: 'multiselect', options: ['low', 'medium', 'high', 'critical'] },
      { key: 'ticket_type', label: 'Ticket Type', type: 'multiselect', options: ['incident', 'service_request', 'problem', 'change'] },
      { key: 'category_id', label: 'Category', type: 'categorical' },
      { key: 'assignee_id', label: 'Assignee', type: 'categorical' },
    ];

    const reportTypes = [
      { key: 'ticket_summary', label: 'Ticket Summary', description: 'Overview of ticket volume, response times, and resolution rates' },
      { key: 'agent_performance', label: 'Agent Performance', description: 'Individual agent metrics including workload, response times, and CSAT' },
      { key: 'sla_compliance', label: 'SLA Compliance', description: 'SLA performance metrics, breaches, and at-risk tickets' },
      { key: 'category_breakdown', label: 'Category Breakdown', description: 'Ticket distribution and resolution times by category' },
      { key: 'problem_summary', label: 'Problem Summary', description: 'Overview of problem management metrics' },
      { key: 'change_summary', label: 'Change Summary', description: 'Overview of change management metrics' },
      { key: 'approval_summary', label: 'Approval Summary', description: 'Overview of approval workflow metrics' },
      { key: 'custom', label: 'Custom Report', description: 'Build your own report with selected metrics and dimensions' },
    ];

    return reply.send({
      data: {
        metrics,
        dimensions,
        filters,
        report_types: reportTypes,
      },
    });
  });

  // ─── Scheduler Status ──────────────────────────────────────────────────────

  // GET /reports/scheduler/status — Get scheduler daemon status
  fastify.get('/reports/scheduler/status', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    // Get scheduler runtime status from the module
    const { getSchedulerStatus } = await import('../services/report-scheduler');
    const schedulerStatus = getSchedulerStatus();

    // Get active schedules count
    const activeCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM report_schedules WHERE is_active = true'
    );
    const activeSchedulesCount = parseInt(activeCountResult.rows[0].count);

    // Get next scheduled run
    const nextRunResult = await pool.query(
      'SELECT MIN(next_run_at) as next_run_at FROM report_schedules WHERE is_active = true AND next_run_at IS NOT NULL'
    );
    const nextRunAt = nextRunResult.rows[0]?.next_run_at || null;

    // Get recent executions (last 10)
    const recentExecutions = await pool.query(
      `SELECT rel.*, sr.name as report_name
       FROM report_execution_log rel
       LEFT JOIN saved_reports sr ON rel.report_id = sr.id
       WHERE rel.schedule_id IS NOT NULL
       ORDER BY rel.started_at DESC
       LIMIT 10`
    );

    return reply.send({
      data: {
        is_running: schedulerStatus.isRunning,
        last_check_at: schedulerStatus.lastCheckAt,
        next_run_at: nextRunAt,
        active_schedules_count: activeSchedulesCount,
        recent_executions: recentExecutions.rows,
      },
    });
  });
}
