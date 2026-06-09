import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import crypto from 'crypto';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type: string, params: Record<string, any>): string {
  const stable = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto.createHash('md5').update(stable).digest('hex');
  return `report:${type}:${hash}`;
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Invalidate all cached aggregation reports. Call after ticket create/update. */
export function invalidateReportCache(): void {
  for (const key of cache.keys()) {
    if (key.startsWith('report:')) {
      cache.delete(key);
    }
  }
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const dateRangeFields = {
  date_from: z.string().optional(),
  date_to: z.string().optional(),
} as const;

const aggregatedTicketsSchema = z.object({
  ...dateRangeFields,
  status: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.union([z.string(), z.array(z.string())]).optional(),
  category_id: z.union([z.string(), z.array(z.string())]).optional(),
  assignee_id: z.union([z.string(), z.array(z.string())]).optional(),
  ticket_type: z.union([z.string(), z.array(z.string())]).optional(),
  group_by: z.enum(['status', 'priority', 'type', 'category', 'assignee']).optional(),
  metrics: z.union([z.string(), z.array(z.string())]).optional(),
});

const aggregatedSlaSchema = z.object({
  ...dateRangeFields,
  category_id: z.union([z.string(), z.array(z.string())]).optional(),
});

const aggregatedPerformanceSchema = z.object({
  ...dateRangeFields,
  assignee_id: z.union([z.string(), z.array(z.string())]).optional(),
});

const timeseriesSchema = z.object({
  ...dateRangeFields,
  interval: z.enum(['day', 'week', 'month']).optional().default('day'),
  metric: z.enum(['created', 'resolved', 'breached']).optional().default('created'),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.union([z.string(), z.array(z.string())]).optional(),
  category_id: z.union([z.string(), z.array(z.string())]).optional(),
  assignee_id: z.union([z.string(), z.array(z.string())]).optional(),
  ticket_type: z.union([z.string(), z.array(z.string())]).optional(),
  group_by: z.enum(['status', 'priority', 'type', 'category', 'assignee']).optional(),
});

const comparisonSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  previous_date_from: z.string().optional(),
  previous_date_to: z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeArray(val: string | string[] | undefined): string[] | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val : [val];
}

function buildDateWhere(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  tableAlias: string,
  paramIdx: { current: number },
  params: any[],
): string {
  let sql = '';
  if (dateFrom) {
    params.push(dateFrom);
    sql += ` AND ${tableAlias}.created_at >= $${paramIdx.current++}`;
  }
  if (dateTo) {
    params.push(dateTo);
    sql += ` AND ${tableAlias}.created_at <= $${paramIdx.current++}`;
  }
  return sql;
}

function buildArrayFilter(
  column: string,
  values: string[] | undefined,
  tableAlias: string,
  paramIdx: { current: number },
  params: any[],
): string {
  if (!values || values.length === 0) return '';
  params.push(values);
  return ` AND ${tableAlias}.${column} = ANY($${paramIdx.current++})`;
}

/** Resolve the group-by column expression and any JOIN needed. */
function resolveGroupBy(
  groupBy: string,
): { select: string; join: string } {
  switch (groupBy) {
    case 'category':
      return { select: "COALESCE(c.name, 'Uncategorized')", join: ' LEFT JOIN categories c ON t.category_id = c.id' };
    case 'assignee':
      return { select: "COALESCE(u.name, 'Unassigned')", join: ' LEFT JOIN users u ON t.assigned_to_id = u.id' };
    case 'type':
      return { select: 't.ticket_type', join: '' };
    default:
      return { select: `t.${groupBy}`, join: '' };
  }
}

// ─── Route Registration ───────────────────────────────────────────────────────

export default async function reportsAggregationRoutes(fastify: FastifyInstance) {

  // ─── GET /reports/aggregated/tickets ──────────────────────────────────────
  // Returns counts grouped by status, priority, type with optional group_by breakdown.
  // Query params: date_from, date_to, status[], priority[], category_id[],
  //               assignee_id[], ticket_type[], group_by, metrics[]
  fastify.get(
    '/reports/aggregated/tickets',
    { preHandler: [fastify.requirePermission('manage_reports')] },
    async (request, reply) => {
      const query = aggregatedTicketsSchema.parse(request.query);
      const cacheKey = getCacheKey('tickets', query);
      const cached = getFromCache(cacheKey);
      if (cached) return reply.send(cached);

      const paramIdx = { current: 1 };
      const params: any[] = [];

      const dateWhere = buildDateWhere(query.date_from, query.date_to, 't', paramIdx, params);
      const filterWhere =
        buildArrayFilter('status', normalizeArray(query.status), 't', paramIdx, params) +
        buildArrayFilter('priority', normalizeArray(query.priority), 't', paramIdx, params) +
        buildArrayFilter('category_id', normalizeArray(query.category_id), 't', paramIdx, params) +
        buildArrayFilter('assigned_to_id', normalizeArray(query.assignee_id), 't', paramIdx, params) +
        buildArrayFilter('ticket_type', normalizeArray(query.ticket_type), 't', paramIdx, params);

      const [byStatusResult, byPriorityResult, byTypeResult, totalResult] = await Promise.all([
        pool.query(
          `SELECT t.status, COUNT(*)::int as count
           FROM tickets t WHERE 1=1${dateWhere}${filterWhere}
           GROUP BY t.status ORDER BY t.status`,
          params,
        ),
        pool.query(
          `SELECT t.priority, COUNT(*)::int as count
           FROM tickets t WHERE 1=1${dateWhere}${filterWhere}
           GROUP BY t.priority ORDER BY t.priority`,
          params,
        ),
        pool.query(
          `SELECT t.ticket_type, COUNT(*)::int as count
           FROM tickets t WHERE 1=1${dateWhere}${filterWhere}
           GROUP BY t.ticket_type ORDER BY t.ticket_type`,
          params,
        ),
        pool.query(
          `SELECT COUNT(*)::int as total FROM tickets t WHERE 1=1${dateWhere}${filterWhere}`,
          params,
        ),
      ]);

      const result: any = {
        data: {
          total: totalResult.rows[0].total,
          by_status: byStatusResult.rows,
          by_priority: byPriorityResult.rows,
          by_type: byTypeResult.rows,
        },
      };

      // Optional group_by breakdown
      if (query.group_by) {
        const { select, join } = resolveGroupBy(query.group_by);
        const grouped = await pool.query(
          `SELECT ${select} as group_key, COUNT(*)::int as count
           FROM tickets t${join}
           WHERE 1=1${dateWhere}${filterWhere}
           GROUP BY ${select} ORDER BY count DESC`,
          params,
        );
        result.data.grouped = grouped.rows;
      }

      setCache(cacheKey, result);
      return reply.send(result);
    },
  );

  // ─── GET /reports/aggregated/sla ──────────────────────────────────────────
  // Returns SLA compliance %, breach counts, at-risk counts,
  // avg response/resolution times.
  // Query params: date_from, date_to, category_id[]
  fastify.get(
    '/reports/aggregated/sla',
    { preHandler: [fastify.requirePermission('manage_reports')] },
    async (request, reply) => {
      const query = aggregatedSlaSchema.parse(request.query);
      const cacheKey = getCacheKey('sla', query);
      const cached = getFromCache(cacheKey);
      if (cached) return reply.send(cached);

      const paramIdx = { current: 1 };
      const params: any[] = [];

      const dateWhere = buildDateWhere(query.date_from, query.date_to, 't', paramIdx, params);
      const filterWhere = buildArrayFilter('category_id', normalizeArray(query.category_id), 't', paramIdx, params);

      const [complianceResult, byPriorityResult, atRiskResult, avgResponseResult, avgResolutionResult] =
        await Promise.all([
          pool.query(
            `SELECT
               COUNT(*)::int as total,
               COUNT(*) FILTER (WHERE t.sla_breached = true)::int as breached,
               COUNT(*) FILTER (WHERE t.sla_breached = false OR t.sla_breached IS NULL)::int as met
             FROM tickets t WHERE 1=1${dateWhere}${filterWhere}`,
            params,
          ),
          pool.query(
            `SELECT
               t.priority,
               COUNT(*)::int as total,
               COUNT(*) FILTER (WHERE t.sla_breached = true)::int as breached
             FROM tickets t WHERE 1=1${dateWhere}${filterWhere}
             GROUP BY t.priority ORDER BY t.priority`,
            params,
          ),
          pool.query(
            `SELECT COUNT(*)::int as at_risk
             FROM tickets t
             WHERE t.status NOT IN ('resolved', 'closed')
               AND t.due_date IS NOT NULL
               AND t.due_date > NOW()
               AND t.due_date <= NOW() + INTERVAL '4 hours'
               AND (t.sla_breached = false OR t.sla_breached IS NULL)
               ${dateWhere}${filterWhere}`,
            params,
          ),
          pool.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600) as avg_response_hours
             FROM tickets t WHERE t.first_response_at IS NOT NULL${dateWhere}${filterWhere}`,
            params,
          ),
          pool.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) as avg_resolution_hours
             FROM tickets t WHERE t.resolved_at IS NOT NULL${dateWhere}${filterWhere}`,
            params,
          ),
        ]);

      const cr = complianceResult.rows[0];
      const total = cr.total;
      const breached = cr.breached;
      const compliancePct = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

      const result = {
        data: {
          compliance: {
            total,
            met: total - breached,
            breached,
            compliance_pct: compliancePct,
          },
          by_priority: byPriorityResult.rows.map((r: any) => ({
            priority: r.priority,
            total: r.total,
            breached: r.breached,
            compliance_pct: r.total > 0
              ? Math.round(((r.total - r.breached) / r.total) * 100)
              : 100,
          })),
          at_risk_count: atRiskResult.rows[0].at_risk,
          avg_response_hours: avgResponseResult.rows[0]?.avg_response_hours
            ? Math.round(parseFloat(avgResponseResult.rows[0].avg_response_hours) * 100) / 100
            : 0,
          avg_resolution_hours: avgResolutionResult.rows[0]?.avg_resolution_hours
            ? Math.round(parseFloat(avgResolutionResult.rows[0].avg_resolution_hours) * 100) / 100
            : 0,
        },
      };

      setCache(cacheKey, result);
      return reply.send(result);
    },
  );

  // ─── GET /reports/aggregated/performance ──────────────────────────────────
  // Returns agent performance metrics (handled, resolved, avg time, breach rate).
  // Query params: date_from, date_to, assignee_id[]
  fastify.get(
    '/reports/aggregated/performance',
    { preHandler: [fastify.requirePermission('manage_reports')] },
    async (request, reply) => {
      const query = aggregatedPerformanceSchema.parse(request.query);
      const cacheKey = getCacheKey('performance', query);
      const cached = getFromCache(cacheKey);
      if (cached) return reply.send(cached);

      const paramIdx = { current: 1 };
      const params: any[] = [];

      const dateWhere = buildDateWhere(query.date_from, query.date_to, 't', paramIdx, params);
      const filterWhere = buildArrayFilter('assigned_to_id', normalizeArray(query.assignee_id), 't', paramIdx, params);

      const result = await pool.query(
        `SELECT
           u.id as agent_id,
           u.name as agent_name,
           u.email as agent_email,
           COUNT(DISTINCT t.id)::int as tickets_handled,
           COUNT(DISTINCT t.id) FILTER (WHERE t.resolved_at IS NOT NULL)::int as tickets_resolved,
           COUNT(DISTINCT t.id) FILTER (WHERE t.sla_breached = true)::int as sla_breaches,
           AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600)
             FILTER (WHERE t.first_response_at IS NOT NULL) as avg_response_hours,
           AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)
             FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours,
           AVG(t.satisfaction_rating) FILTER (WHERE t.satisfaction_rating IS NOT NULL) as csat_avg
         FROM users u
         JOIN tickets t ON t.assigned_to_id = u.id
         WHERE u.role IN ('admin', 'agent') AND u.is_active = true${dateWhere}${filterWhere}
         GROUP BY u.id, u.name, u.email
         ORDER BY tickets_handled DESC`,
        params,
      );

      const rows = result.rows.map((r: any) => ({
        agent_id: r.agent_id,
        agent_name: r.agent_name,
        agent_email: r.agent_email,
        tickets_handled: r.tickets_handled,
        tickets_resolved: r.tickets_resolved,
        sla_breaches: r.sla_breaches,
        breach_rate: r.tickets_handled > 0
          ? Math.round((r.sla_breaches / r.tickets_handled) * 100)
          : 0,
        avg_response_hours: parseFloat(r.avg_response_hours) || 0,
        avg_resolution_hours: parseFloat(r.avg_resolution_hours) || 0,
        csat_avg: r.csat_avg ? parseFloat(r.csat_avg) : null,
      }));

      const totalHandled = rows.reduce((s: number, r: any) => s + r.tickets_handled, 0);
      const totalResolved = rows.reduce((s: number, r: any) => s + r.tickets_resolved, 0);
      const totalBreaches = rows.reduce((s: number, r: any) => s + r.sla_breaches, 0);

      const response = {
        data: {
          agents: rows,
          summary: {
            total_agents: rows.length,
            total_handled: totalHandled,
            total_resolved: totalResolved,
            total_sla_breaches: totalBreaches,
            overall_breach_rate: totalHandled > 0
              ? Math.round((totalBreaches / totalHandled) * 100)
              : 0,
            overall_resolution_rate: totalHandled > 0
              ? Math.round((totalResolved / totalHandled) * 100)
              : 0,
          },
        },
      };

      setCache(cacheKey, response);
      return reply.send(response);
    },
  );

  // ─── GET /reports/aggregated/timeseries ───────────────────────────────────
  // Returns time series data for charts.
  // Query params: date_from, date_to, interval (day/week/month),
  //               metric (created/resolved/breached), optional filters + group_by
  fastify.get(
    '/reports/aggregated/timeseries',
    { preHandler: [fastify.requirePermission('manage_reports')] },
    async (request, reply) => {
      const query = timeseriesSchema.parse(request.query);
      const cacheKey = getCacheKey('timeseries', query);
      const cached = getFromCache(cacheKey);
      if (cached) return reply.send(cached);

      const paramIdx = { current: 1 };
      const params: any[] = [];

      const dateWhere = buildDateWhere(query.date_from, query.date_to, 't', paramIdx, params);
      const filterWhere =
        buildArrayFilter('status', normalizeArray(query.status), 't', paramIdx, params) +
        buildArrayFilter('priority', normalizeArray(query.priority), 't', paramIdx, params) +
        buildArrayFilter('category_id', normalizeArray(query.category_id), 't', paramIdx, params) +
        buildArrayFilter('assigned_to_id', normalizeArray(query.assignee_id), 't', paramIdx, params) +
        buildArrayFilter('ticket_type', normalizeArray(query.ticket_type), 't', paramIdx, params);

      const dateTrunc = `date_trunc('${query.interval}', t.created_at)`;

      let metricSelect: string;
      switch (query.metric) {
        case 'resolved':
          metricSelect = "COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL)::int as value";
          break;
        case 'breached':
          metricSelect = "COUNT(*) FILTER (WHERE t.sla_breached = true)::int as value";
          break;
        default:
          metricSelect = 'COUNT(*)::int as value';
      }

      const timeseries = await pool.query(
        `SELECT ${dateTrunc}::text as date, ${metricSelect}
         FROM tickets t WHERE 1=1${dateWhere}${filterWhere}
         GROUP BY ${dateTrunc}
         ORDER BY ${dateTrunc} ASC`,
        params,
      );

      const total = timeseries.rows.reduce((s: number, r: any) => s + r.value, 0);

      // Optional group_by breakdown per time slice
      let breakdown: any[] | undefined;
      if (query.group_by) {
        const { select, join } = resolveGroupBy(query.group_by);
        const bd = await pool.query(
          `SELECT ${dateTrunc}::text as date,
                  ${select} as group_key,
                  ${metricSelect}
           FROM tickets t${join}
           WHERE 1=1${dateWhere}${filterWhere}
           GROUP BY ${dateTrunc}, ${select}
           ORDER BY date ASC, group_key`,
          params,
        );
        breakdown = bd.rows;
      }

      const result: any = {
        data: {
          metric: query.metric,
          interval: query.interval,
          total,
          timeseries: timeseries.rows,
        },
      };
      if (breakdown) result.data.breakdown = breakdown;

      setCache(cacheKey, result);
      return reply.send(result);
    },
  );

  // ─── GET /reports/aggregated/comparison ───────────────────────────────────
  // Returns current period vs previous period for all key metrics.
  // Query params: date_from, date_to,
  //               previous_date_from, previous_date_to (optional — auto-calculated)
  fastify.get(
    '/reports/aggregated/comparison',
    { preHandler: [fastify.requirePermission('manage_reports')] },
    async (request, reply) => {
      const query = comparisonSchema.parse(request.query);
      const cacheKey = getCacheKey('comparison', query);
      const cached = getFromCache(cacheKey);
      if (cached) return reply.send(cached);

      const currentDateFrom = query.date_from;
      const currentDateTo = query.date_to;

      // Auto-calculate previous period if not provided (same length before current)
      let prevDateFrom = query.previous_date_from;
      let prevDateTo = query.previous_date_to;

      if (!prevDateFrom || !prevDateTo) {
        const currentLen = new Date(currentDateTo).getTime() - new Date(currentDateFrom).getTime();
        prevDateTo = new Date(new Date(currentDateFrom).getTime() - 1).toISOString();
        prevDateFrom = new Date(new Date(prevDateTo).getTime() - currentLen).toISOString();
      }

      async function getPeriodStats(df: string, dt: string, label: string) {
        const pIdx = { current: 1 };
        const p: any[] = [df, dt];

        const result = await pool.query(
          `SELECT
             COUNT(*)::int as total_tickets,
             COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL)::int as resolved_tickets,
             COUNT(*) FILTER (WHERE t.sla_breached = true)::int as sla_breaches,
             AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600)
               FILTER (WHERE t.first_response_at IS NOT NULL) as avg_response_hours,
             AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)
               FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours,
             AVG(t.satisfaction_rating) FILTER (WHERE t.satisfaction_rating IS NOT NULL) as csat_avg
           FROM tickets t
           WHERE t.created_at >= $1 AND t.created_at <= $2`,
          p,
        );

        const row = result.rows[0];
        const totalTickets = row.total_tickets;
        const resolvedTickets = row.resolved_tickets;
        const slaBreaches = row.sla_breaches;

        return {
          label,
          total_tickets: totalTickets,
          resolved_tickets: resolvedTickets,
          resolution_rate: totalTickets > 0
            ? Math.round((resolvedTickets / totalTickets) * 100)
            : 0,
          sla_breaches: slaBreaches,
          sla_compliance_pct: totalTickets > 0
            ? Math.round(((totalTickets - slaBreaches) / totalTickets) * 100)
            : 100,
          avg_response_hours: row.avg_response_hours
            ? Math.round(parseFloat(row.avg_response_hours) * 100) / 100
            : 0,
          avg_resolution_hours: row.avg_resolution_hours
            ? Math.round(parseFloat(row.avg_resolution_hours) * 100) / 100
            : 0,
          csat_avg: row.csat_avg
            ? Math.round(parseFloat(row.csat_avg) * 100) / 100
            : null,
        };
      }

      const [current, previous] = await Promise.all([
        getPeriodStats(currentDateFrom, currentDateTo, 'current'),
        getPeriodStats(prevDateFrom, prevDateTo, 'previous'),
      ]);

      // Calculate deltas for numeric metrics
      const numericMetrics = [
        'total_tickets', 'resolved_tickets', 'resolution_rate',
        'sla_breaches', 'sla_compliance_pct', 'avg_response_hours', 'avg_resolution_hours',
      ] as const;

      const changes: Record<string, { current: number; previous: number; change: number; change_pct: number | null }> = {};
      for (const metric of numericMetrics) {
        const cur = current[metric] as number;
        const prev = previous[metric] as number;
        changes[metric] = {
          current: cur,
          previous: prev,
          change: cur - prev,
          change_pct: prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null,
        };
      }

      const result = {
        data: {
          current_period: current,
          previous_period: previous,
          changes,
        },
      };

      setCache(cacheKey, result);
      return reply.send(result);
    },
  );
}
