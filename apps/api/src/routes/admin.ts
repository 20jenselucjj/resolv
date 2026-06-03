import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { getDefaultTemplates } from '../services/email-template-engine';

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
    if (query.action) {
      whereClause += ` AND al.action ILIKE $${paramIdx++}`;
      params.push(`%${query.action}%`);
    }
    if (query.actor_name) {
      whereClause += ` AND u.name ILIKE $${paramIdx++}`;
      params.push(`%${query.actor_name}%`);
    }
    if (query.search) {
      whereClause += ` AND (al.action ILIKE $${paramIdx} OR al.entity_type ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }
    if (query.date_from) {
      whereClause += ` AND al.created_at >= $${paramIdx++}`;
      params.push(query.date_from);
    }
    if (query.date_to) {
      whereClause += ` AND al.created_at <= $${paramIdx++}`;
      params.push(query.date_to);
    }

    // Use a subquery for count when filtering on joined table columns
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_log al LEFT JOIN users u ON al.actor_id = u.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT al.*, u.name as actor_name 
       FROM audit_log al 
       LEFT JOIN users u ON al.actor_id = u.id 
       ${whereClause}
       ORDER BY al.created_at DESC 
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    // Get distinct entity types for filter dropdown
    const entityTypes = await pool.query(
      `SELECT DISTINCT entity_type FROM audit_log WHERE entity_type IS NOT NULL ORDER BY entity_type`
    );

    return reply.send({
      data: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      entity_types: entityTypes.rows.map((r: any) => r.entity_type),
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

  // PATCH /admin/settings/agent_secret_key - regenerate agent secret
  fastify.patch('/admin/settings/agent_secret_key', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const newSecret = require('crypto').randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('agent_secret_key', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [newSecret, request.user.id]
    );
    return reply.send({ data: { agent_secret_key: newSecret } });
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
      'status_label_open', 'status_label_in_progress', 'status_label_waiting', 'status_label_resolved', 'status_label_closed',
      'canned_responses', 'custom_statuses',
      'smtp_oauth_config',
      'status_order', 'role_permissions',
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
      `SELECT key, value FROM system_settings WHERE key = ANY($1::text[])`,
      [keys]
    );
    const settings: Record<string, string> = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    return reply.send({ data: settings });
  });

  fastify.get('/settings/canned-responses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'canned_responses'");
    const raw = result.rows[0]?.value;
    const defaults = [
      { id: '1', text: "Hi there, we've received your request and are looking into it.", category: 'General' },
      { id: '2', text: "Could you please provide more details or screenshots to help us investigate?", category: 'General' },
      { id: '3', text: "We have resolved the issue. Please confirm if everything is working for you now.", category: 'Resolution' },
      { id: '4', text: "Closing this ticket due to inactivity. Feel free to reply if you still need help.", category: 'Resolution' },
    ];

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Handle both legacy (string array) and new (object array) formats
        const normalized = Array.isArray(parsed) ? parsed.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            return { id: String(idx + 1), text: item, category: 'General' };
          }
          return { id: item.id || String(idx + 1), text: item.text || '', category: item.category || 'General' };
        }) : defaults;
        return reply.send({ data: normalized });
      } catch { return reply.send({ data: defaults }); }
    }
    return reply.send({ data: defaults });
  });

  // ─── Email Templates ───────────────────────────────────────────────────

  async function loadEmailTemplates(): Promise<any[]> {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'email_templates'");
    if (result.rows.length === 0) return [];
    try {
      return JSON.parse(result.rows[0].value);
    } catch {
      return [];
    }
  }

  async function saveEmailTemplates(templates: any[]): Promise<void> {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('email_templates', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(templates)]
    );
  }

  function slugifyName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // GET /admin/email-templates/defaults
  fastify.get('/admin/email-templates/defaults', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const defaults = getDefaultTemplates();
    const result = defaults.map(t => ({
      id: slugifyName(t.name),
      name: t.name,
      subject: t.subject,
      body: t.body,
      is_default: true,
    }));
    return reply.send({ data: result });
  });

  // GET /admin/email-templates
  fastify.get('/admin/email-templates', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const defaults = getDefaultTemplates();
    const dbTemplates = await loadEmailTemplates();
    const dbByName = new Map<string, any>();
    for (const t of dbTemplates) {
      dbByName.set((t.name || '').toLowerCase(), t);
    }

    const merged: any[] = [];

    // For each default, use DB version if it exists (user override), else use default
    for (const d of defaults) {
      const key = d.name.toLowerCase();
      const db = dbByName.get(key);
      if (db) {
        merged.push({ ...db, is_default: true });
        dbByName.delete(key);
      } else {
        merged.push({
          id: slugifyName(d.name),
          name: d.name,
          subject: d.subject,
          body: d.body,
          is_default: true,
        });
      }
    }

    // Append remaining DB templates that don't match a default (custom templates)
    for (const t of dbByName.values()) {
      merged.push({ ...t, is_default: false });
    }

    return reply.send({ data: merged });
  });

  // POST /admin/email-templates
  const emailTemplateSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    subject: z.string().min(1).max(500),
    body: z.string().default(''),
  });

  fastify.post('/admin/email-templates', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = emailTemplateSchema.parse(request.body);
    const templates = await loadEmailTemplates();

    // If a template with the same name already exists, update it
    const existingIndex = templates.findIndex((t: any) => t.name === body.name);
    if (existingIndex !== -1) {
      templates[existingIndex] = {
        ...templates[existingIndex],
        name: body.name,
        subject: body.subject,
        body: body.body,
        id: body.id || templates[existingIndex].id,
      };
      await saveEmailTemplates(templates);
      return reply.send({ data: templates[existingIndex] });
    }

    const newTemplate = {
      id: body.id || crypto.randomUUID(),
      name: body.name,
      subject: body.subject,
      body: body.body,
    };
    templates.push(newTemplate);
    await saveEmailTemplates(templates);
    return reply.status(201).send({ data: newTemplate });
  });

  // PATCH /admin/email-templates/:id
  const emailTemplateUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(500).optional(),
    body: z.string().optional(),
  });

  fastify.patch('/admin/email-templates/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = emailTemplateUpdateSchema.parse(request.body);
    const templates = await loadEmailTemplates();
    const index = templates.findIndex((t: any) => t.id === id);
    if (index === -1) {
      return reply.status(404).send({ error: 'Email template not found' });
    }
    templates[index] = { ...templates[index], ...body };
    await saveEmailTemplates(templates);
    return reply.send({ data: templates[index] });
  });

  // DELETE /admin/email-templates/:id
  fastify.delete('/admin/email-templates/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const templates = await loadEmailTemplates();
    const index = templates.findIndex((t: any) => t.id === id);
    if (index === -1) {
      return reply.status(404).send({ error: 'Email template not found' });
    }
    templates.splice(index, 1);
    await saveEmailTemplates(templates);
    return reply.send({ success: true });
  });

  // ─── Role Permissions ──────────────────────────────────────────────────

  // GET /admin/roles - get role permissions (with defaults)
  fastify.get('/admin/roles', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'role_permissions'");
    if (result.rows.length === 0) {
      return reply.send({
        data: [
          { id: 'admin', permissions: [
            { key: 'manage_users', enabled: true },
            { key: 'manage_settings', enabled: true },
            { key: 'manage_sla', enabled: true },
            { key: 'manage_categories', enabled: true },
            { key: 'delete_tickets', enabled: true },
            { key: 'view_audit_log', enabled: true },
            { key: 'manage_automation', enabled: true },
            { key: 'view_all_tickets', enabled: true },
            { key: 'assign_tickets', enabled: true },
          ]},
          { id: 'agent', permissions: [
            { key: 'manage_users', enabled: false },
            { key: 'manage_settings', enabled: false },
            { key: 'manage_sla', enabled: false },
            { key: 'manage_categories', enabled: false },
            { key: 'delete_tickets', enabled: false },
            { key: 'view_audit_log', enabled: false },
            { key: 'manage_automation', enabled: false },
            { key: 'view_all_tickets', enabled: true },
            { key: 'assign_tickets', enabled: true },
          ]},
          { id: 'user', permissions: [
            { key: 'manage_users', enabled: false },
            { key: 'manage_settings', enabled: false },
            { key: 'manage_sla', enabled: false },
            { key: 'manage_categories', enabled: false },
            { key: 'delete_tickets', enabled: false },
            { key: 'view_audit_log', enabled: false },
            { key: 'manage_automation', enabled: false },
            { key: 'view_all_tickets', enabled: false },
            { key: 'assign_tickets', enabled: false },
          ]},
        ],
      });
    }
    try {
      return reply.send({ data: JSON.parse(result.rows[0].value) });
    } catch {
      return reply.send({ data: [] });
    }
  });

  // PUT /admin/roles - persist role permissions
  fastify.put('/admin/roles', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      roles: z.array(z.object({
        id: z.string(),
        permissions: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
      })),
    }).parse(request.body);

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('role_permissions', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify(body.roles), request.user.id]
    );

    await pool.query(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
      [request.user.id, 'update_roles', 'system_settings', 'role_permissions', JSON.stringify(body)]
    );

    return reply.send({ success: true });
  });

  // ─── Time-Series Stats ─────────────────────────────────────────────────

  // GET /admin/stats/time-series
  fastify.get('/admin/stats/time-series', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const query = request.query as any;
    const range = query.range || '7d';

    let interval: string;
    let dateTrunc: string;
    let since: string;

    if (range === '7d') {
      interval = '1 day';
      dateTrunc = 'day';
      since = '7 days';
    } else if (range === '30d') {
      interval = '1 day';
      dateTrunc = 'day';
      since = '30 days';
    } else if (range === '90d') {
      interval = '1 week';
      dateTrunc = 'week';
      since = '90 days';
    } else {
      interval = '1 month';
      dateTrunc = 'month';
      since = '100 years';
    }

    const ticketsResult = await pool.query(
      `SELECT date_trunc('${dateTrunc}', created_at) as date,
              COUNT(*) as created,
              COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) as resolved
       FROM tickets WHERE created_at >= NOW() - INTERVAL '${since}'
       GROUP BY 1 ORDER BY 1`
    );

    const slaResult = await pool.query(
      `SELECT date_trunc('${dateTrunc}', created_at) as date,
              COUNT(*) as breached
       FROM tickets WHERE sla_breached = true AND created_at >= NOW() - INTERVAL '${since}'
       GROUP BY 1 ORDER BY 1`
    );

    const avgResResult = await pool.query(
      `SELECT date_trunc('${dateTrunc}', created_at) as date,
              AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as hours
       FROM tickets WHERE resolved_at IS NOT NULL AND created_at >= NOW() - INTERVAL '${since}'
       GROUP BY 1 ORDER BY 1`
    );

    return reply.send({
      data: {
        tickets: ticketsResult.rows,
        sla: slaResult.rows,
        avg_resolution: avgResResult.rows,
      },
    });
  });

  // ─── Notification Settings ────────────────────────────────────────────

  function getDefaultNotificationSettings() {
    return {
      ticket_created: { email: true, in_app: true },
      ticket_assigned: { email: true, in_app: true },
      ticket_updated: { email: false, in_app: true },
      ticket_resolved: { email: true, in_app: true },
      sla_breach: { email: true, in_app: true },
      comment_added: { email: false, in_app: true },
    };
  }

  // GET /admin/notification-settings
  fastify.get('/admin/notification-settings', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'notification_settings'");
    if (result.rows.length === 0) {
      return reply.send({ data: getDefaultNotificationSettings() });
    }
    try {
      return reply.send({ data: JSON.parse(result.rows[0].value) });
    } catch {
      return reply.send({ data: getDefaultNotificationSettings() });
    }
  });

  // PUT /admin/notification-settings
  fastify.put('/admin/notification-settings', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      settings: z.record(z.object({
        email: z.boolean(),
        in_app: z.boolean(),
      })),
    }).parse(request.body);

    const jsonValue = JSON.stringify(body.settings);

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('notification_settings', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [jsonValue, request.user.id]
    );

    await pool.query(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
      [request.user.id, 'update_notification_settings', 'system_settings', 'notification_settings', JSON.stringify(body.settings)]
    );

    return reply.send({ success: true });
  });

  // ─── Workflows ────────────────────────────────────────────────────────

  // GET /admin/workflows
  fastify.get('/admin/workflows', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query('SELECT * FROM ticket_workflows ORDER BY from_status, to_status');
    return reply.send({ data: result.rows });
  });

  // POST /admin/workflows
  fastify.post('/admin/workflows', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      from_status: z.string(),
      to_status: z.string(),
      required_fields: z.array(z.string()).optional().default([]),
    }).parse(request.body);

    const result = await pool.query(
      'INSERT INTO ticket_workflows (from_status, to_status, required_fields) VALUES ($1, $2, $3) RETURNING *',
      [body.from_status, body.to_status, body.required_fields]
    );

    await pool.query(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
      [request.user.id, 'create_workflow', 'ticket_workflows', result.rows[0].id, JSON.stringify(body)]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /admin/workflows/:id
  fastify.patch('/admin/workflows/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      from_status: z.string().optional(),
      to_status: z.string().optional(),
      required_fields: z.array(z.string()).optional(),
    }).parse(request.body);

    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return reply.send({ data: null });
    const setClauses = fields.map(([k], i) => (k === 'required_fields' ? `${k} = $${i + 2}` : `${k} = $${i + 2}`)).join(', ');
    const values = fields.map(([, v]) => v);
    const result = await pool.query(
      `UPDATE ticket_workflows SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /admin/workflows/:id
  fastify.delete('/admin/workflows/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM ticket_workflows WHERE id = $1', [id]);
    return reply.send({ success: true });
  });

  // ─── Holidays ─────────────────────────────────────────────────────────

  // GET /admin/holidays
  fastify.get('/admin/holidays', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query('SELECT * FROM holidays ORDER BY date ASC');
    return reply.send({ data: result.rows });
  });

  // POST /admin/holidays
  fastify.post('/admin/holidays', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      date: z.string(),
    }).parse(request.body);

    const result = await pool.query(
      'INSERT INTO holidays (name, date) VALUES ($1, $2::date) RETURNING *',
      [body.name, body.date]
    );

    await pool.query(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
      [request.user.id, 'create_holiday', 'holidays', result.rows[0].id, JSON.stringify(body)]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // DELETE /admin/holidays/:id
  fastify.delete('/admin/holidays/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM holidays WHERE id = $1', [id]);
    return reply.send({ success: true });
  });

  // ─── Agent Performance ────────────────────────────────────────────────

  // GET /admin/agent-performance
  fastify.get('/admin/agent-performance', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const query = request.query as any;
    const range = query.range || '7d';

    let since: string;
    if (range === '30d') {
      since = '30 days';
    } else if (range === '90d') {
      since = '90 days';
    } else {
      since = '7 days';
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email,
              COUNT(DISTINCT t.id) FILTER (WHERE t.created_at >= NOW() - INTERVAL '${since}') as tickets_assigned,
              COUNT(DISTINCT t.id) FILTER (WHERE t.resolved_at >= NOW() - INTERVAL '${since}') as tickets_resolved,
              AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600) FILTER (WHERE t.first_response_at IS NOT NULL AND t.created_at >= NOW() - INTERVAL '${since}') as avg_response_hours,
              AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL AND t.created_at >= NOW() - INTERVAL '${since}') as avg_resolution_hours,
              AVG(t.satisfaction_rating) FILTER (WHERE t.satisfaction_rating IS NOT NULL AND t.created_at >= NOW() - INTERVAL '${since}') as csat_avg
       FROM users u
       LEFT JOIN tickets t ON t.assigned_to_id = u.id
       WHERE u.role = 'agent' AND u.is_active = true
       GROUP BY u.id, u.name, u.email
       ORDER BY tickets_resolved DESC`
    );

    return reply.send({ data: result.rows });
  });

  // ─── Maintenance Mode ─────────────────────────────────────────────────

  // GET /admin/maintenance
  fastify.get('/admin/maintenance', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenance_mode'");
    if (result.rows.length === 0) {
      return reply.send({ data: { enabled: false, message: '' } });
    }
    try {
      return reply.send({ data: JSON.parse(result.rows[0].value) });
    } catch {
      return reply.send({ data: { enabled: false, message: '' } });
    }
  });

  // PATCH /admin/maintenance
  fastify.patch('/admin/maintenance', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.boolean(),
      message: z.string().optional().default(''),
    }).parse(request.body);

    const jsonValue = JSON.stringify(body);

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('maintenance_mode', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [jsonValue, request.user.id]
    );

    await pool.query(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
      [request.user.id, 'update_maintenance', 'system_settings', 'maintenance_mode', jsonValue]
    );

    return reply.send({ data: body });
  });

  // ─── AI Template Generation ───────────────────────────────────────────

  // POST /admin/ai/generate-template - AI-powered template/rule generation
  fastify.post('/admin/ai/generate-template', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      type: z.enum(['email_template', 'auto_reply_rule']),
      prompt: z.string().min(1),
      existingTemplate: z.object({
        name: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
        conditions: z.any().optional(),
        event: z.string().optional(),
      }).optional(),
    }).parse(request.body);

    // Load AI config
    const { rows } = await pool.query('SELECT * FROM ai_config LIMIT 1');
    const cfg = rows[0];
    if (!cfg?.enabled || !cfg?.api_key) {
      return reply.status(400).send({ error: 'AI is not configured. Please configure AI in Admin > AI Settings.' });
    }

    // Build system prompt based on type
    const systemPrompt = body.type === 'email_template'
      ? `You are an expert email template designer for IT service management systems. Generate professional HTML email templates.

Available variables (use [VARIABLE_NAME] syntax):
- TICKET_ID, TICKET_TITLE, TICKET_URL
- USER_NAME, AGENT_NAME, REQUESTOR_NAME, ASSIGNED_TO_NAME
- PRIORITY, PRIORITY_COLOR, STATUS, STATUS_COLOR
- CREATED_AT, DUE_DATE, CATEGORY, TICKET_TYPE
- DESCRIPTION, COMMENT_BODY, CLOSE_NOTES, RESOLVED_AT, PREVIOUS_ASSIGNEE

Requirements:
- Return valid HTML email body (no <html>, <head>, <body> tags - just the content)
- Use inline styles for email client compatibility
- Use a clean, professional design with proper spacing
- Include the RESOLV branding at the top
- Use responsive table-based layout
- Colors should match the priority/status when using PRIORITY_COLOR/STATUS_COLOR variables
- Keep the design simple but professional

Return ONLY the HTML content, no explanations.`
      : `You are an expert at designing IT service management automation rules. Generate auto-reply rules with conditions and email content.

Available variables for email content (use [VARIABLE_NAME] syntax):
- TICKET_ID, TICKET_TITLE, TICKET_URL
- USER_NAME, AGENT_NAME, REQUESTOR_NAME, ASSIGNED_TO_NAME
- PRIORITY, STATUS, CREATED_AT, DUE_DATE, CATEGORY, TICKET_TYPE
- DESCRIPTION, COMMENT_BODY

Available conditions:
- ticket_types: array of ['incident', 'service_request', 'problem', 'change']
- priorities: array of ['low', 'medium', 'high', 'critical']
- statuses: array of ['open', 'in_progress', 'waiting', 'resolved', 'closed']
- category_id: string (category UUID)
- keyword: string (matches in title/description)

Available events: 'any', 'ticket_created', 'ticket_assigned', 'ticket_reassigned', 'status_changed', 'comment_added', 'ticket_resolved', 'ticket_closed'

Return a JSON object with:
{
  "name": "Rule name",
  "description": "Brief description",
  "event": "event_type",
  "conditions": {
    "ticket_types": [],
    "priorities": [],
    "statuses": [],
    "keyword": ""
  },
  "reply_subject": "Subject line with [VARIABLES]",
  "reply_body": "Plain text or simple HTML body"
}

Return ONLY valid JSON, no explanations or markdown.`;

    const userMessage = body.existingTemplate
      ? `Modify this existing template:\n\n${JSON.stringify(body.existingTemplate)}\n\nChanges requested: ${body.prompt}`
      : body.prompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const apiBase = (cfg.base_url || '').replace(/\/+$/, '');
    const aiResponse = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text().catch(() => '');
      const detail = errBody || `AI provider returned ${aiResponse.status} ${aiResponse.statusText}`;
      return reply.status(502).send({ error: `AI API error: ${detail}` });
    }

    const aiData = await aiResponse.json() as any;
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    if (!aiContent) {
      return reply.status(502).send({ error: 'AI returned empty response' });
    }

    if (body.type === 'email_template') {
      return reply.send({
        data: {
          name: '',
          subject: '',
          body: aiContent,
        },
      });
    }

    // Auto-reply rule: parse JSON from AI response
    try {
      const parsed = JSON.parse(aiContent);
      return reply.send({
        data: {
          name: parsed.name || '',
          subject: '',
          body: '',
          conditions: parsed.conditions || {},
          event: parsed.event || '',
          reply_subject: parsed.reply_subject || '',
          reply_body: parsed.reply_body || '',
        },
      });
    } catch {
      // Try to extract JSON from the response if direct parse fails
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return reply.send({
            data: {
              name: parsed.name || '',
              subject: '',
              body: '',
              conditions: parsed.conditions || {},
              event: parsed.event || '',
              reply_subject: parsed.reply_subject || '',
              reply_body: parsed.reply_body || '',
            },
          });
        } catch {
          return reply.status(502).send({ error: 'AI returned invalid JSON for auto-reply rule. Please try again or refine your prompt.' });
        }
      }
      return reply.status(502).send({ error: 'AI returned invalid JSON for auto-reply rule. Please try again or refine your prompt.' });
    }
  });
}
