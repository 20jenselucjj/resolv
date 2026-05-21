import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function adminRoutes(fastify: FastifyInstance) {
  // GET /admin/stats - admin only
  fastify.get('/admin/stats', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    // Tickets stats
    const ticketStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as created_today,
        COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE) as resolved_today,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
      FROM tickets
    `);

    const byStatus = await pool.query('SELECT status, COUNT(*) FROM tickets GROUP BY status');
    const byPriority = await pool.query('SELECT priority, COUNT(*) FROM tickets GROUP BY priority');
    const byType = await pool.query('SELECT ticket_type as type, COUNT(*) FROM tickets GROUP BY ticket_type');

    // Users stats
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active_count
      FROM users
    `);
    const byRole = await pool.query('SELECT role, COUNT(*) FROM users GROUP BY role');

    // SLA stats
    const slaStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE sla_breached = true) as breached_count,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed') AND due_date IS NOT NULL AND due_date <= (NOW() + INTERVAL '2 hours') AND due_date > NOW()) as at_risk_count
      FROM tickets
    `);

    // Recent activity
    const recentActivity = await pool.query(`
      SELECT al.*, u.name as actor_name 
      FROM audit_log al 
      LEFT JOIN users u ON al.actor_id = u.id 
      ORDER BY al.created_at DESC 
      LIMIT 20
    `);

    const formatCounts = (rows: any[], key: string) => {
      const obj: Record<string, number> = {};
      rows.forEach(row => {
        obj[row[key]] = parseInt(row.count);
      });
      return obj;
    };

    return reply.send({
      data: {
        tickets: {
          total: parseInt(ticketStats.rows[0].total),
          by_status: formatCounts(byStatus.rows, 'status'),
          by_priority: formatCounts(byPriority.rows, 'priority'),
          by_type: formatCounts(byType.rows, 'type'),
          created_today: parseInt(ticketStats.rows[0].created_today),
          resolved_today: parseInt(ticketStats.rows[0].resolved_today),
          avg_resolution_hours: parseFloat(ticketStats.rows[0].avg_resolution_hours || 0),
        },
        users: {
          total: parseInt(userStats.rows[0].total),
          by_role: formatCounts(byRole.rows, 'role'),
          active_count: parseInt(userStats.rows[0].active_count),
        },
        sla: {
          breached_count: parseInt(slaStats.rows[0].breached_count),
          at_risk_count: parseInt(slaStats.rows[0].at_risk_count),
        },
        recent_activity: recentActivity.rows,
      }
    });
  });

  // GET /admin/audit-log - admin only
  fastify.get('/admin/audit-log', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '50')));
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.entity_type) {
      whereClause += ` AND al.entity_type = $${paramIdx++}`;
      params.push(query.entity_type);
    }
    if (query.actor_id) {
      whereClause += ` AND al.actor_id = $${paramIdx++}`;
      params.push(query.actor_id);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_log al ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT al.*, u.name as actor_name 
       FROM audit_log al 
       LEFT JOIN users u ON al.actor_id = u.id 
       ${whereClause}
       ORDER BY al.created_at DESC 
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      pageSize,
    });
  });

  // GET /admin/settings - admin only
  fastify.get('/admin/settings', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const settings: Record<string, string | null> = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return reply.send({ data: settings });
  });

  // PATCH /admin/settings - admin only
  fastify.patch('/admin/settings', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const ALLOWED_SETTINGS_KEYS = [
      'company_name', 'support_email', 'timezone', 'date_format', 'time_format',
      'tickets_per_page', 'default_priority', 'default_ticket_type',
      'sla_enabled', 'sla_response_hours', 'sla_resolution_hours',
      'email_notifications_enabled', 'max_attachment_size_mb',
      'working_hours_enabled', 'auto_close_resolved_days',
      'portal_hero_title', 'portal_hero_subtitle', 'portal_company_name',
      'portal_qa_1_label', 'portal_qa_1_prompt',
      'portal_qa_2_label', 'portal_qa_2_prompt',
      'portal_qa_3_label', 'portal_qa_3_prompt',
      'portal_qa_4_label', 'portal_qa_4_prompt',
      'portal_qa_5_label', 'portal_qa_5_prompt',
      'portal_qa_6_label', 'portal_qa_6_prompt',
      'available_tags',
      'status_label_open', 'status_label_in_progress', 'status_label_waiting', 'status_label_resolved', 'status_label_closed',
      'canned_responses',
    ] as const;

    const body = z.object({
      key: z.enum(ALLOWED_SETTINGS_KEYS),
      value: z.string().nullable(),
    }).parse(request.body);

    const result = await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE 
       SET value = $2, updated_at = NOW(), updated_by = $3
       RETURNING *`,
      [body.key, body.value, request.user.id]
    );

    await pool.query(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
      [request.user.id, 'update_setting', 'system_settings', result.rows[0].id, JSON.stringify({ key: body.key, value: body.value })]
    );

    return reply.send({ data: result.rows[0] });
  });

  // GET /admin/tags
  fastify.get('/admin/tags', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    // Get configured tags from settings
    const settingResult = await pool.query("SELECT value FROM system_settings WHERE key = 'available_tags'");
    const configuredTags: string[] = settingResult.rows[0]?.value ? JSON.parse(settingResult.rows[0].value) : [];
    
    // Get tags actually used in tickets
    const usedResult = await pool.query(`
      SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count
      FROM tickets 
      WHERE array_length(tags, 1) > 0
      GROUP BY tag
      ORDER BY count DESC
    `);
    const usedTags = usedResult.rows.map(r => ({ tag: r.tag, count: parseInt(r.count) }));
    
    return reply.send({ data: { configured: configuredTags, used: usedTags } });
  });

  // GET /admin/automation-rules
  fastify.get('/admin/automation-rules', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query('SELECT * FROM automation_rules ORDER BY created_at DESC');
    return reply.send({ data: result.rows });
  });

  // POST /admin/automation-rules
  fastify.post('/admin/automation-rules', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      trigger: z.string().min(1),
      condition: z.string().optional().nullable(),
      action: z.string().min(1),
      action_value: z.string().optional().nullable(),
      enabled: z.boolean().optional().default(true),
    }).parse(request.body);
    const result = await pool.query(
      'INSERT INTO automation_rules (name, trigger, condition, action, action_value, enabled) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [body.name, body.trigger, body.condition ?? null, body.action, body.action_value ?? null, body.enabled]
    );
    await pool.query('INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1,$2,$3,$4,$5)',
      [request.user.id, 'create_automation_rule', 'automation_rules', result.rows[0].id, JSON.stringify(body)]);
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /admin/automation-rules/:id
  fastify.patch('/admin/automation-rules/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      name: z.string().optional(),
      enabled: z.boolean().optional(),
      trigger: z.string().optional(),
      condition: z.string().nullable().optional(),
      action: z.string().optional(),
      action_value: z.string().nullable().optional(),
    }).parse(request.body);
    const fields = Object.entries(body).filter(([,v]) => v !== undefined);
    if (fields.length === 0) return reply.send({ data: null });
    const setClauses = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([,v]) => v);
    const result = await pool.query(
      `UPDATE automation_rules SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return reply.send({ data: result.rows[0] });
  });

  // DELETE /admin/automation-rules/:id
  fastify.delete('/admin/automation-rules/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM automation_rules WHERE id = $1', [id]);
    return reply.send({ success: true });
  });

  // GET /admin/working-hours
  fastify.get('/admin/working-hours', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query('SELECT * FROM working_hours ORDER BY CASE day WHEN \'Monday\' THEN 1 WHEN \'Tuesday\' THEN 2 WHEN \'Wednesday\' THEN 3 WHEN \'Thursday\' THEN 4 WHEN \'Friday\' THEN 5 WHEN \'Saturday\' THEN 6 WHEN \'Sunday\' THEN 7 END');
    return reply.send({ data: result.rows });
  });

  // PUT /admin/working-hours
  fastify.put('/admin/working-hours', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      timezone: z.string().optional(),
      hours: z.array(z.object({
        day: z.string(),
        enabled: z.boolean(),
        start_time: z.string(),
        end_time: z.string(),
      })),
    }).parse(request.body);

    for (const h of body.hours) {
      await pool.query(
        `INSERT INTO working_hours (day, enabled, start_time, end_time) VALUES ($1,$2,$3,$4)
         ON CONFLICT (day) DO UPDATE SET enabled=$2, start_time=$3, end_time=$4, updated_at=NOW()`,
        [h.day, h.enabled, h.start_time, h.end_time]
      );
    }
    if (body.timezone) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES ('timezone', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW(), updated_by=$2`,
        [body.timezone, request.user.id]
      );
    }
    return reply.send({ success: true });
  });

  // Public portal settings (no auth required)
  fastify.get('/settings/portal', async (request, reply) => {
    const keys = [
      'portal_hero_title', 'portal_hero_subtitle', 'portal_company_name',
      'portal_qa_1_label', 'portal_qa_1_prompt',
      'portal_qa_2_label', 'portal_qa_2_prompt',
      'portal_qa_3_label', 'portal_qa_3_prompt',
      'portal_qa_4_label', 'portal_qa_4_prompt',
      'portal_qa_5_label', 'portal_qa_5_prompt',
      'portal_qa_6_label', 'portal_qa_6_prompt',
    ];
    const result = await pool.query(
      `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
      [keys]
    );
    const settings: Record<string, string> = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    return reply.send({ data: settings });
  });

  fastify.get('/settings/canned-responses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'canned_responses'");
    const raw = result.rows[0]?.value;
    let responses = [
      "Hi there, we've received your request and are looking into it.",
      "Could you please provide more details or screenshots to help us investigate?",
      "We have resolved the issue. Please confirm if everything is working for you now.",
      "Closing this ticket due to inactivity. Feel free to reply if you still need help.",
    ];
    if (raw) { try { responses = JSON.parse(raw); } catch {} }
    return reply.send({ data: responses });
  });
}
