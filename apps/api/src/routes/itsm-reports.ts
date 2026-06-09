import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

function formatCounts(rows: any[], key: string): Record<string, number> {
  const obj: Record<string, number> = {};
  rows.forEach(row => {
    obj[row[key]] = parseInt(row.count);
  });
  return obj;
}

function isValidRange(range: string): boolean {
  return ['7d', '30d', '90d'].includes(range);
}

function buildRangeDays(range: string): number {
  return parseInt(range);
}

export default async function itsmReportsRoutes(fastify: FastifyInstance) {

  // ─── Problem Management Metrics ─────────────────────────────────────────────
  fastify.get('/reports/problems', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const query = request.query as any;
    const range = isValidRange(query.range) ? query.range : '30d';
    const days = buildRangeDays(range);
    const params = [days];

    const [
      totalResult,
      byStatusResult,
      byPriorityResult,
      mttrResult,
      trendResult,
      topCausesResult,
      linkRateResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM problems WHERE created_at >= NOW() - INTERVAL '1 day' * $1`, params),
      pool.query(`SELECT status, COUNT(*) as count FROM problems WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY status`, params),
      pool.query(`SELECT priority, COUNT(*) as count FROM problems WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY priority`, params),
      pool.query(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600), 0) as mttr_hours
         FROM problems
         WHERE status IN ('resolved', 'closed') AND resolved_at IS NOT NULL
           AND created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT DATE(created_at) as day, COUNT(*) as count
         FROM problems
         WHERE created_at >= NOW() - INTERVAL '1 day' * $1
         GROUP BY DATE(created_at) ORDER BY day`,
        params
      ),
      pool.query(
        `SELECT COALESCE(c.name, 'Uncategorized') as category, COUNT(*) as count
         FROM problems p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.created_at >= NOW() - INTERVAL '1 day' * $1
         GROUP BY c.name
         ORDER BY count DESC LIMIT 5`,
        params
      ),
      pool.query(
        `WITH problem_counts AS (
           SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE id IN (SELECT problem_id FROM problem_incident_links)) as linked
           FROM problems
           WHERE created_at >= NOW() - INTERVAL '1 day' * $1
         )
         SELECT CASE WHEN total = 0 THEN 0 ELSE ROUND(linked::numeric / total * 100, 1) END as rate
         FROM problem_counts`,
        params
      ),
    ]);

    return reply.send({
      data: {
        total: parseInt(totalResult.rows[0].count),
        by_status: formatCounts(byStatusResult.rows, 'status'),
        by_priority: formatCounts(byPriorityResult.rows, 'priority'),
        mttr_hours: parseFloat(mttrResult.rows[0].mttr_hours),
        created_trend: trendResult.rows.map(r => ({ day: r.day, count: parseInt(r.count) })),
        top_root_causes: topCausesResult.rows.map(r => ({ category: r.category, count: parseInt(r.count) })),
        incident_link_rate: parseFloat(linkRateResult.rows[0].rate),
      },
    });
  });

  // ─── Change Management Metrics ─────────────────────────────────────────────
  fastify.get('/reports/changes', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const query = request.query as any;
    const range = isValidRange(query.range) ? query.range : '30d';
    const days = buildRangeDays(range);
    const params = [days];

    const [
      totalResult,
      byStatusResult,
      byTypeResult,
      byRiskResult,
      byPriorityResult,
      successRateResult,
      rollbackRateResult,
      avgImplHoursResult,
      emergencyResult,
      pirResult,
      trendResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1`, params),
      pool.query(`SELECT status, COUNT(*) as count FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY status`, params),
      pool.query(`SELECT change_type as type, COUNT(*) as count FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY change_type`, params),
      pool.query(`SELECT risk_level, COUNT(*) as count FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY risk_level`, params),
      pool.query(`SELECT priority, COUNT(*) as count FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY priority`, params),
      pool.query(
        `SELECT CASE WHEN COUNT(*) FILTER (WHERE status IN ('completed', 'rejected', 'rolled_back')) = 0 THEN 0
           ELSE ROUND(
             COUNT(*) FILTER (WHERE status = 'completed')::numeric /
             COUNT(*) FILTER (WHERE status IN ('completed', 'rejected', 'rolled_back')) * 100, 1)
         END as success_rate
         FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT CASE WHEN COUNT(*) FILTER (WHERE status IN ('completed', 'rolled_back')) = 0 THEN 0
           ELSE ROUND(
             COUNT(*) FILTER (WHERE status = 'rolled_back')::numeric /
             COUNT(*) FILTER (WHERE status IN ('completed', 'rolled_back')) * 100, 1)
         END as rollback_rate
         FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_end - actual_start))/3600), 0) as avg_hours
         FROM changes
         WHERE status = 'completed' AND actual_start IS NOT NULL AND actual_end IS NOT NULL
           AND created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE change_type = 'emergency') as emergency_count,
           CASE WHEN COUNT(*) = 0 THEN 0
             ELSE ROUND(COUNT(*) FILTER (WHERE change_type = 'emergency')::numeric / COUNT(*) * 100, 1)
           END as emergency_rate
         FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT CASE WHEN COUNT(*) FILTER (WHERE status = 'completed') = 0 THEN 0
           ELSE ROUND(
             COUNT(*) FILTER (WHERE status = 'completed' AND post_implementation_review IS NOT NULL)::numeric /
             COUNT(*) FILTER (WHERE status = 'completed') * 100, 1)
         END as pir_rate
         FROM changes WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT DATE(created_at) as day, COUNT(*) as count
         FROM changes
         WHERE created_at >= NOW() - INTERVAL '1 day' * $1
         GROUP BY DATE(created_at) ORDER BY day`,
        params
      ),
    ]);

    return reply.send({
      data: {
        total: parseInt(totalResult.rows[0].count),
        by_status: formatCounts(byStatusResult.rows, 'status'),
        by_type: formatCounts(byTypeResult.rows, 'type'),
        by_risk: formatCounts(byRiskResult.rows, 'risk_level'),
        by_priority: formatCounts(byPriorityResult.rows, 'priority'),
        success_rate: parseFloat(successRateResult.rows[0].success_rate),
        rollback_rate: parseFloat(rollbackRateResult.rows[0].rollback_rate),
        avg_implementation_hours: parseFloat(avgImplHoursResult.rows[0].avg_hours),
        emergency_count: parseInt(emergencyResult.rows[0].emergency_count),
        emergency_rate: parseFloat(emergencyResult.rows[0].emergency_rate),
        pir_completion_rate: parseFloat(pirResult.rows[0].pir_rate),
        created_trend: trendResult.rows.map(r => ({ day: r.day, count: parseInt(r.count) })),
      },
    });
  });

  // ─── Approval Metrics ──────────────────────────────────────────────────────
  fastify.get('/reports/approvals', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const query = request.query as any;
    const range = isValidRange(query.range) ? query.range : '30d';
    const days = buildRangeDays(range);
    const params = [days];

    const [
      totalResult,
      byStatusResult,
      avgDecisionResult,
      byEntityResult,
      overdueResult,
      approvalRateResult,
      trendResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM approval_requests WHERE created_at >= NOW() - INTERVAL '1 day' * $1`, params),
      pool.query(`SELECT status, COUNT(*) as count FROM approval_requests WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY status`, params),
      pool.query(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600), 0) as avg_hours
         FROM approval_requests
         WHERE status IN ('approved', 'denied') AND created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(`SELECT entity_type, COUNT(*) as count FROM approval_requests WHERE created_at >= NOW() - INTERVAL '1 day' * $1 GROUP BY entity_type`, params),
      pool.query(
        `SELECT COUNT(*) FROM approval_requests
         WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < NOW()
           AND created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT CASE WHEN COUNT(*) FILTER (WHERE status IN ('approved', 'denied')) = 0 THEN 0
           ELSE ROUND(
             COUNT(*) FILTER (WHERE status = 'approved')::numeric /
             COUNT(*) FILTER (WHERE status IN ('approved', 'denied')) * 100, 1)
         END as approval_rate
         FROM approval_requests WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
        params
      ),
      pool.query(
        `SELECT DATE(created_at) as day, COUNT(*) as count
         FROM approval_requests
         WHERE created_at >= NOW() - INTERVAL '1 day' * $1
         GROUP BY DATE(created_at) ORDER BY day`,
        params
      ),
    ]);

    return reply.send({
      data: {
        total: parseInt(totalResult.rows[0].count),
        by_status: formatCounts(byStatusResult.rows, 'status'),
        avg_time_to_decide_hours: parseFloat(avgDecisionResult.rows[0].avg_hours),
        by_entity_type: formatCounts(byEntityResult.rows, 'entity_type'),
        overdue_count: parseInt(overdueResult.rows[0].count),
        approval_rate: parseFloat(approvalRateResult.rows[0].approval_rate),
        created_trend: trendResult.rows.map(r => ({ day: r.day, count: parseInt(r.count) })),
      },
    });
  });

  // ─── License Compliance Metrics ─────────────────────────────────────────────
  // Supports optional ?range=7d|30d|90d to filter by license created_at date.
  fastify.get('/reports/licenses', { preHandler: [fastify.requirePermission('manage_reports')] }, async (request, reply) => {
    const q = request.query as any;
    const range = isValidRange(q.range) ? q.range : null;

    // Helper to build WHERE suffix for date filtering.
    // Returns { suffix: string, p: any[] } where p contains the days param if used.
    function dateFilter(existingWhere: boolean, altParamIdx?: number): { suffix: string; p: any[] } {
      if (!range) return { suffix: '', p: [] };
      const idx = altParamIdx ?? 1;
      const prefix = existingWhere ? ' AND' : ' WHERE';
      return { suffix: `${prefix} created_at >= NOW() - INTERVAL '1 day' * $${idx}`, p: [buildRangeDays(range)] };
    }

    const base = dateFilter(false);
    const [
      totalResult,
      byComplianceResult,
      costResult,
      seatResult,
      expiringResult,
      overallocatedResult,
      byPublisherResult,
      byTypeResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM software_licenses${base.suffix}`, base.p),
      pool.query(`SELECT compliance_status, COUNT(*) as count FROM software_licenses${base.suffix} GROUP BY compliance_status`, base.p),
      pool.query(
        `SELECT COALESCE(SUM(total_cost), 0) as total_cost,
           CASE WHEN SUM(total_cost) IS NOT NULL AND COUNT(*) > 0
             THEN ROUND(SUM(total_cost)::numeric / NULLIF(COUNT(*), 0), 2)
             ELSE 0
           END as avg_cost
         FROM software_licenses${base.suffix}`,
        base.p
      ),
      pool.query(
        `SELECT COALESCE(SUM(total_seats), 0) as total_seats,
           COALESCE(SUM(used_seats), 0) as used_seats
         FROM software_licenses${base.suffix}`,
        base.p
      ),
      pool.query(
        `SELECT COUNT(*) FROM software_licenses
         WHERE expiry_date IS NOT NULL
           AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
           AND expiry_date >= CURRENT_DATE${dateFilter(true).suffix}`,
        dateFilter(true).p
      ),
      pool.query(
        `SELECT COUNT(*) FROM software_licenses
         WHERE used_seats > total_seats AND total_seats > 0${dateFilter(true).suffix}`,
        dateFilter(true).p
      ),
      pool.query(
        `SELECT publisher, COALESCE(SUM(total_cost), 0) as total_cost
         FROM software_licenses
         WHERE publisher IS NOT NULL${dateFilter(true).suffix}
         GROUP BY publisher
         ORDER BY total_cost DESC LIMIT 10`,
        dateFilter(true).p
      ),
      pool.query(`SELECT license_type as type, COUNT(*) as count FROM software_licenses${base.suffix} GROUP BY license_type`, base.p),
    ]);

    const totalSeats = parseInt(seatResult.rows[0].total_seats);
    const usedSeats = parseInt(seatResult.rows[0].used_seats);
    const utilizationRate = totalSeats > 0 ? parseFloat((usedSeats / totalSeats * 100).toFixed(1)) : 0;

    return reply.send({
      data: {
        total: parseInt(totalResult.rows[0].count),
        by_compliance: formatCounts(byComplianceResult.rows, 'compliance_status'),
        total_cost: parseFloat(costResult.rows[0].total_cost),
        cost_per_seat_avg: parseFloat(costResult.rows[0].avg_cost),
        total_seats: totalSeats,
        used_seats: usedSeats,
        utilization_rate: utilizationRate,
        expiring_soon: parseInt(expiringResult.rows[0].count),
        over_allocated: parseInt(overallocatedResult.rows[0].count),
        by_publisher: byPublisherResult.rows.map(r => ({ publisher: r.publisher, total_cost: parseFloat(r.total_cost) })),
        by_type: formatCounts(byTypeResult.rows, 'type'),
      },
    });
  });

}
