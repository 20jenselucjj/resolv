import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pool } from '../db/pool';
import { getDefaultTemplates } from '../services/email-template-engine';
import { invalidateRolePermsCache } from '../plugins/auth';
import { saveBusinessHoursConfig, updateDaySchedule, addHoliday, getHolidays, removeHoliday } from '../services/business-hours';

const execFileAsync = promisify(execFile);

export default async function adminRoutes(fastify: FastifyInstance) {
  // GET /admin/stats - admin only
  fastify.get('/admin/stats', { preHandler: [fastify.requirePermission('view_all_tickets')] }, async (request, reply) => {
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
  fastify.get('/admin/audit-log', { preHandler: [fastify.requirePermission('view_audit_log')] }, async (request, reply) => {
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
  fastify.get('/admin/settings', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const settings: Record<string, string | null> = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return reply.send({ data: settings });
  });

  // PATCH /admin/settings/agent_secret_key - regenerate agent secret
  fastify.patch('/admin/settings/agent_secret_key', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
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
  fastify.patch('/admin/settings', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const ALLOWED_SETTINGS_KEYS = [
      'company_name', 'support_email', 'timezone', 'date_format', 'time_format',
      'tickets_per_page', 'default_priority', 'default_ticket_type', 'max_failed_attempts',
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
      'portal_section_header', 'portal_section_description',
      'portal_button_text',
      'portal_success_title', 'portal_success_subtitle',
      'portal_tickets_header', 'portal_no_tickets_text',
      'portal_chat_header', 'portal_chat_subtitle',
      'portal_chat_empty_title', 'portal_chat_empty_description',
      'portal_chip_1_label', 'portal_chip_1_prompt',
      'portal_chip_2_label', 'portal_chip_2_prompt',
      'portal_chip_3_label', 'portal_chip_3_prompt',
      'portal_chip_4_label', 'portal_chip_4_prompt',
      'portal_input_placeholder', 'portal_input_hint',
      'portal_kb_header', 'portal_all_clear_text', 'portal_no_articles_text',
      'status_label_open', 'status_label_in_progress', 'status_label_waiting', 'status_label_resolved', 'status_label_closed',
      'canned_responses', 'custom_statuses',
      'smtp_oauth_config',
      'status_order', 'status_ticket_types', 'role_permissions',
      // Problem Management
      'problem_root_cause_template', 'problem_auto_link_enabled', 'problem_auto_link_similarity',
      'ke_require_approval', 'ke_auto_archive_days', 'problem_default_priority',
      // Change Management
      'change_auto_approve_standard',
      'change_risk_low_desc', 'change_risk_medium_desc', 'change_risk_high_desc', 'change_risk_critical_desc',
      'change_cab_risk_threshold',
      'change_blackout_enabled', 'change_blackout_message',
      'change_pir_required', 'change_pir_types',
      'change_impl_plan_template', 'change_rollback_template',
      // Approval Workflows
      'approval_due_critical_hours', 'approval_due_high_hours', 'approval_due_medium_hours', 'approval_due_low_hours',
      'approval_escalation_enabled', 'approval_escalation_hours', 'approval_escalation_target',
      'approval_normal_steps', 'approval_emergency_steps',
      'approval_notify_created', 'approval_notify_approved', 'approval_notify_denied', 'approval_notify_escalated',
      // Reopen Policy
      'reopen_window_days',
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

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_setting', 'system_settings', result.rows[0].id, JSON.stringify({ key: body.key, value: body.value })]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // ─── REMOVED: Legacy automation rules ─────────────────────────────────────
  // The legacy `/admin/automation-rules` CRUD and `automation_rules` table have been removed.
  // All automation should use Visual Workflows (see /workflows/visual routes).

  // GET /admin/working-hours — consolidated into business_hours table
  fastify.get('/admin/working-hours', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query(`
      SELECT
        CASE day_of_week
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day,
        is_business_day as enabled,
        start_time::varchar(5) as start_time,
        end_time::varchar(5) as end_time
      FROM business_hours
      ORDER BY day_of_week
    `);
    return reply.send({ data: result.rows });
  });

  // PUT /admin/working-hours — consolidated into business_hours table
  const DAY_NAME_TO_INT: Record<string, number> = {
    'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
    'Friday': 5, 'Saturday': 6, 'Sunday': 0,
  };
  fastify.put('/admin/working-hours', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
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
      const dow = DAY_NAME_TO_INT[h.day];
      if (dow === undefined) continue;
      const startTime = h.start_time.includes(':') ? h.start_time + ':00' : h.start_time;
      const endTime = h.end_time.includes(':') ? h.end_time + ':00' : h.end_time;
      await updateDaySchedule(dow, startTime, endTime, h.enabled);
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
      'portal_section_header', 'portal_section_description',
      'portal_button_text',
      'portal_success_title', 'portal_success_subtitle',
      'portal_tickets_header', 'portal_no_tickets_text',
      'portal_chat_header', 'portal_chat_subtitle',
      'portal_chat_empty_title', 'portal_chat_empty_description',
      'portal_chip_1_label', 'portal_chip_1_prompt',
      'portal_chip_2_label', 'portal_chip_2_prompt',
      'portal_chip_3_label', 'portal_chip_3_prompt',
      'portal_chip_4_label', 'portal_chip_4_prompt',
      'portal_input_placeholder', 'portal_input_hint',
      'portal_kb_header', 'portal_all_clear_text', 'portal_no_articles_text',
      'status_label_open', 'status_label_in_progress', 'status_label_waiting',
      'status_label_resolved', 'status_label_closed',
      'custom_statuses', 'status_order', 'status_ticket_types',
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
    subject: z.string().max(500).default(''),
    body: z.string().default(''),
  });

  fastify.post('/admin/email-templates', { preHandler: [fastify.requirePermission('manage_email_templates')] }, async (request, reply) => {
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
    subject: z.string().max(500).optional(),
    body: z.string().optional(),
  });

  fastify.patch('/admin/email-templates/:id', { preHandler: [fastify.requirePermission('manage_email_templates')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = emailTemplateUpdateSchema.parse(request.body);
    const templates = await loadEmailTemplates();
    const index = templates.findIndex((t: any) => t.id === id);
    if (index === -1) {
      // Not found in saved templates — check if it matches a default template
      const defaults = getDefaultTemplates();
      const defaultMatch = defaults.find(d => slugifyName(d.name) === id);
      if (defaultMatch) {
        // Auto-create the saved template with default values + PATCH body
        const newTemplate = {
          id: crypto.randomUUID(),
          name: body.name || defaultMatch.name,
          subject: body.subject ?? defaultMatch.subject,
          body: body.body ?? defaultMatch.body,
        };
        templates.push(newTemplate);
        await saveEmailTemplates(templates);
        return reply.send({ data: newTemplate });
      }
      return reply.status(404).send({ error: 'Email template not found' });
    }
    templates[index] = { ...templates[index], ...body };
    await saveEmailTemplates(templates);
    return reply.send({ data: templates[index] });
  });

  // DELETE /admin/email-templates/:id
  fastify.delete('/admin/email-templates/:id', { preHandler: [fastify.requirePermission('manage_email_templates')] }, async (request, reply) => {
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

  const DEFAULT_ROLES_RAW = [
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
      { key: 'manage_assets', enabled: true },
      { key: 'manage_asset_groups', enabled: true },
      { key: 'manage_email_templates', enabled: true },
      { key: 'manage_notification_settings', enabled: true },
      { key: 'manage_workflows', enabled: true },
      { key: 'manage_backup', enabled: true },
      { key: 'manage_ai_config', enabled: true },
      { key: 'manage_directory_sync', enabled: true },
      { key: 'manage_portal', enabled: true },
      { key: 'manage_agent_settings', enabled: true },
      { key: 'manage_reports', enabled: true },
      { key: 'manage_integrations', enabled: true },
      // ITSM modules
      { key: 'view_problems', enabled: true },
      { key: 'manage_problems', enabled: true },
      { key: 'delete_problems', enabled: true },
      { key: 'view_changes', enabled: true },
      { key: 'create_changes', enabled: true },
      { key: 'manage_changes', enabled: true },
      { key: 'approve_changes', enabled: true },
      { key: 'delete_changes', enabled: true },
      { key: 'manage_knowledge', enabled: true },
      { key: 'delete_knowledge', enabled: true },
      { key: 'view_knowledge_drafts', enabled: true },
      { key: 'create_approvals', enabled: true },
      { key: 'vote_approvals', enabled: true },
      { key: 'view_licenses', enabled: true },
      { key: 'manage_licenses', enabled: true },
      { key: 'delete_licenses', enabled: true },
      { key: 'manage_catalog', enabled: true },
      { key: 'delete_catalog', enabled: true },
      { key: 'manage_custom_fields', enabled: true },
      { key: 'manage_classification', enabled: true },
    ]},
    { id: 'manager', permissions: [
      { key: 'manage_users', enabled: true },
      { key: 'manage_settings', enabled: false },
      { key: 'manage_sla', enabled: true },
      { key: 'manage_categories', enabled: true },
      { key: 'delete_tickets', enabled: false },
      { key: 'view_audit_log', enabled: true },
      { key: 'manage_automation', enabled: true },
      { key: 'view_all_tickets', enabled: true },
      { key: 'assign_tickets', enabled: true },
      { key: 'manage_assets', enabled: true },
      { key: 'manage_asset_groups', enabled: true },
      { key: 'manage_email_templates', enabled: true },
      { key: 'manage_notification_settings', enabled: true },
      { key: 'manage_workflows', enabled: false },
      { key: 'manage_backup', enabled: false },
      { key: 'manage_ai_config', enabled: false },
      { key: 'manage_directory_sync', enabled: false },
      { key: 'manage_portal', enabled: true },
      { key: 'manage_agent_settings', enabled: true },
      { key: 'manage_reports', enabled: true },
      { key: 'manage_integrations', enabled: false },
      // ITSM modules
      { key: 'view_problems', enabled: true },
      { key: 'manage_problems', enabled: true },
      { key: 'delete_problems', enabled: false },
      { key: 'view_changes', enabled: true },
      { key: 'create_changes', enabled: true },
      { key: 'manage_changes', enabled: true },
      { key: 'approve_changes', enabled: true },
      { key: 'delete_changes', enabled: false },
      { key: 'manage_knowledge', enabled: true },
      { key: 'delete_knowledge', enabled: false },
      { key: 'view_knowledge_drafts', enabled: true },
      { key: 'create_approvals', enabled: true },
      { key: 'vote_approvals', enabled: true },
      { key: 'view_licenses', enabled: true },
      { key: 'manage_licenses', enabled: true },
      { key: 'delete_licenses', enabled: false },
      { key: 'manage_catalog', enabled: true },
      { key: 'delete_catalog', enabled: false },
      { key: 'manage_custom_fields', enabled: true },
      { key: 'manage_classification', enabled: true },
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
      { key: 'manage_assets', enabled: true },
      { key: 'manage_asset_groups', enabled: false },
      { key: 'manage_email_templates', enabled: false },
      { key: 'manage_notification_settings', enabled: false },
      { key: 'manage_workflows', enabled: false },
      { key: 'manage_backup', enabled: false },
      { key: 'manage_ai_config', enabled: false },
      { key: 'manage_directory_sync', enabled: false },
      { key: 'manage_portal', enabled: false },
      { key: 'manage_agent_settings', enabled: false },
      { key: 'manage_reports', enabled: false },
      { key: 'manage_integrations', enabled: false },
      // ITSM modules
      { key: 'view_problems', enabled: true },
      { key: 'manage_problems', enabled: true },
      { key: 'delete_problems', enabled: false },
      { key: 'view_changes', enabled: true },
      { key: 'create_changes', enabled: true },
      { key: 'manage_changes', enabled: true },
      { key: 'approve_changes', enabled: false },
      { key: 'delete_changes', enabled: false },
      { key: 'manage_knowledge', enabled: true },
      { key: 'delete_knowledge', enabled: false },
      { key: 'view_knowledge_drafts', enabled: true },
      { key: 'create_approvals', enabled: false },
      { key: 'vote_approvals', enabled: false },
      { key: 'view_licenses', enabled: true },
      { key: 'manage_licenses', enabled: false },
      { key: 'delete_licenses', enabled: false },
      { key: 'manage_catalog', enabled: false },
      { key: 'delete_catalog', enabled: false },
      { key: 'manage_custom_fields', enabled: false },
      { key: 'manage_classification', enabled: false },
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
      { key: 'manage_assets', enabled: false },
      { key: 'manage_asset_groups', enabled: false },
      { key: 'manage_email_templates', enabled: false },
      { key: 'manage_notification_settings', enabled: false },
      { key: 'manage_workflows', enabled: false },
      { key: 'manage_backup', enabled: false },
      { key: 'manage_ai_config', enabled: false },
      { key: 'manage_directory_sync', enabled: false },
      { key: 'manage_portal', enabled: false },
      { key: 'manage_agent_settings', enabled: false },
      { key: 'manage_reports', enabled: false },
      { key: 'manage_integrations', enabled: false },
      // ITSM modules
      { key: 'view_problems', enabled: false },
      { key: 'manage_problems', enabled: false },
      { key: 'delete_problems', enabled: false },
      { key: 'view_changes', enabled: false },
      { key: 'create_changes', enabled: false },
      { key: 'manage_changes', enabled: false },
      { key: 'approve_changes', enabled: false },
      { key: 'delete_changes', enabled: false },
      { key: 'manage_knowledge', enabled: false },
      { key: 'delete_knowledge', enabled: false },
      { key: 'view_knowledge_drafts', enabled: false },
      { key: 'create_approvals', enabled: false },
      { key: 'vote_approvals', enabled: false },
      { key: 'view_licenses', enabled: false },
      { key: 'manage_licenses', enabled: false },
      { key: 'delete_licenses', enabled: false },
      { key: 'manage_catalog', enabled: false },
      { key: 'delete_catalog', enabled: false },
      { key: 'manage_custom_fields', enabled: false },
      { key: 'manage_classification', enabled: false },
    ]},
    { id: 'readonly', permissions: [
      { key: 'manage_users', enabled: false },
      { key: 'manage_settings', enabled: false },
      { key: 'manage_sla', enabled: false },
      { key: 'manage_categories', enabled: false },
      { key: 'delete_tickets', enabled: false },
      { key: 'view_audit_log', enabled: true },
      { key: 'manage_automation', enabled: false },
      { key: 'view_all_tickets', enabled: true },
      { key: 'assign_tickets', enabled: false },
      { key: 'manage_assets', enabled: false },
      { key: 'manage_asset_groups', enabled: false },
      { key: 'manage_email_templates', enabled: false },
      { key: 'manage_notification_settings', enabled: false },
      { key: 'manage_workflows', enabled: false },
      { key: 'manage_backup', enabled: false },
      { key: 'manage_ai_config', enabled: false },
      { key: 'manage_directory_sync', enabled: false },
      { key: 'manage_portal', enabled: false },
      { key: 'manage_agent_settings', enabled: false },
      { key: 'manage_reports', enabled: true },
      { key: 'manage_integrations', enabled: false },
      // ITSM modules
      { key: 'view_problems', enabled: true },
      { key: 'manage_problems', enabled: false },
      { key: 'delete_problems', enabled: false },
      { key: 'view_changes', enabled: true },
      { key: 'create_changes', enabled: false },
      { key: 'manage_changes', enabled: false },
      { key: 'approve_changes', enabled: false },
      { key: 'delete_changes', enabled: false },
      { key: 'manage_knowledge', enabled: false },
      { key: 'delete_knowledge', enabled: false },
      { key: 'view_knowledge_drafts', enabled: false },
      { key: 'create_approvals', enabled: false },
      { key: 'vote_approvals', enabled: false },
      { key: 'view_licenses', enabled: true },
      { key: 'manage_licenses', enabled: false },
      { key: 'delete_licenses', enabled: false },
      { key: 'manage_catalog', enabled: false },
      { key: 'delete_catalog', enabled: false },
      { key: 'manage_custom_fields', enabled: false },
      { key: 'manage_classification', enabled: false },
    ]},
  ];

  // GET /admin/roles - get role permissions (with defaults)
  fastify.get('/admin/roles', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'role_permissions'");
    if (result.rows.length === 0) {
      return reply.send({ data: DEFAULT_ROLES_RAW });
    }
    try {
      return reply.send({ data: JSON.parse(result.rows[0].value) });
    } catch {
      return reply.send({ data: DEFAULT_ROLES_RAW });
    }
  });

  // PUT /admin/roles - persist role permissions
  fastify.put('/admin/roles', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
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

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_roles', 'system_settings', 'role_permissions', JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    invalidateRolePermsCache();

    return reply.send({ success: true });
  });

  // ─── Time-Series Stats ─────────────────────────────────────────────────

  // GET /admin/stats/time-series
  fastify.get('/admin/stats/time-series', { preHandler: [fastify.requirePermission('view_all_tickets')] }, async (request, reply) => {
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

    const VALID_DATE_TRUNCS = ['day', 'week', 'month'] as const;
    const VALID_SINCE = ['7 days', '30 days', '90 days', '100 years'] as const;
    if (!VALID_DATE_TRUNCS.includes(dateTrunc as any) || !VALID_SINCE.includes(since as any)) {
      return reply.status(400).send({ error: 'Invalid range parameter' });
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
  fastify.get('/admin/notification-settings', { preHandler: [fastify.requirePermission('manage_notification_settings')] }, async (request, reply) => {
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
  fastify.put('/admin/notification-settings', { preHandler: [fastify.requirePermission('manage_notification_settings')] }, async (request, reply) => {
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

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_notification_settings', 'system_settings', 'notification_settings', JSON.stringify(body.settings)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

  // ─── REMOVED: Legacy ticket_workflows CRUD ─────────────────────────────
  // The legacy `/admin/workflows` status-transition CRUD and `ticket_workflows` table
  // have been removed. Use Visual Workflows (Workflow Designer) instead.

  // ─── Holidays ─────────────────────────────────────────────────────────
  // Consolidated into business_holidays table

  // GET /admin/holidays
  fastify.get('/admin/holidays', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const holidays = await getHolidays();
    const mapped = holidays.map((h: any) => ({
      id: h.id,
      name: h.name,
      date: h.holiday_date,
      recurring: h.is_annual,
    }));
    return reply.send({ data: mapped });
  });

  // POST /admin/holidays
  fastify.post('/admin/holidays', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      date: z.string(),
    }).parse(request.body);

    await addHoliday(body.name, new Date(body.date), false);
    const holidays = await getHolidays();
    const created = holidays[holidays.length - 1];

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'create_holiday', 'business_holidays', created.id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: { id: created.id, name: created.name, date: created.holiday_date, recurring: created.is_annual } });
  });

  // DELETE /admin/holidays/:id
  fastify.delete('/admin/holidays/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { deleted } = await removeHoliday(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Holiday not found' });
    }
    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_holiday', 'business_holidays', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }
    return reply.send({ success: true });
  });

  // ─── Agent Performance ────────────────────────────────────────────────

  // GET /admin/agent-performance
  fastify.get('/admin/agent-performance', { preHandler: [fastify.requirePermission('view_all_tickets')] }, async (request, reply) => {
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

    const VALID_SINCE = ['7 days', '30 days', '90 days'] as const;
    if (!VALID_SINCE.includes(since as any)) {
      return reply.status(400).send({ error: 'Invalid range parameter' });
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
  fastify.get('/admin/maintenance', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
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
  fastify.patch('/admin/maintenance', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
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

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_maintenance', 'system_settings', 'maintenance_mode', jsonValue]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: body });
  });

  // ─── AI Template Generation ───────────────────────────────────────────

  // POST /admin/ai/generate-template - AI-powered template/rule generation
  fastify.post('/admin/ai/generate-template', { preHandler: [fastify.requirePermission('manage_ai_config')] }, async (request, reply) => {
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

Return your response as a JSON object with two fields:
{
  "subject": "A short, descriptive subject line using [VARIABLES]",
  "body": "The HTML email body content"
}
Return ONLY valid JSON, no explanations or markdown.`
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

    // Parse JSON from AI response
    try {
      const parsed = JSON.parse(aiContent);
      if (body.type === 'email_template') {
        return reply.send({
          data: {
            name: parsed.name || '',
            subject: parsed.subject || '',
            body: parsed.body || '',
          },
        });
      }
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
          if (body.type === 'email_template') {
            return reply.send({
              data: {
                name: parsed.name || '',
                subject: parsed.subject || '',
                body: parsed.body || '',
              },
            });
          }
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
          const label = body.type === 'email_template' ? 'email template' : 'auto-reply rule';
          return reply.status(502).send({ error: `AI returned invalid JSON for ${label}. Please try again or refine your prompt.` });
        }
      }
      const label = body.type === 'email_template' ? 'email template' : 'auto-reply rule';
      return reply.status(502).send({ error: `AI returned invalid JSON for ${label}. Please try again or refine your prompt.` });
    }
  });

  // POST /admin/backup - generate a pg_dump SQL backup
  fastify.post('/admin/backup', { preHandler: [fastify.authenticate, fastify.requirePermission('manage_backup')] }, async (request, reply) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return reply.status(500).send({ error: 'DATABASE_URL environment variable is not set' });
    }

    let parsed: URL;
    try {
      parsed = new URL(dbUrl);
    } catch {
      return reply.status(500).send({ error: 'DATABASE_URL is not a valid URL' });
    }

    const host = parsed.hostname;
    const port = parsed.port || '5432';
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const dbname = parsed.pathname.replace(/^\//, '');

    if (!host || !user || !dbname) {
      return reply.status(500).send({ error: 'DATABASE_URL is missing required connection details (host, user, dbname)' });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `resolv-backup-${dateStr}.sql`;

    try {
      const { stdout } = await execFileAsync('pg_dump', [
        '--host', host,
        '--port', port,
        '--username', user,
        '--dbname', dbname,
        '--no-password',
        '--format', 'p',
        '--clean',
      ], {
        env: { ...process.env, PGPASSWORD: password },
        maxBuffer: 100 * 1024 * 1024,
        timeout: 120_000,
      });

      // Log to audit_log
      try {
        await pool.query(
          'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
          [request.user.id, 'backup_created', 'system', 'backup', JSON.stringify({ filename, timestamp: new Date().toISOString() })]
        );
      } catch (logErr: any) {
        fastify.log.error({ err: logErr }, 'Failed to write audit log');
      }

      return reply
        .header('Content-Type', 'application/sql')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(stdout);
    } catch (err: any) {
      fastify.log.error(err, 'pg_dump backup failed');
      return reply.status(500).send({ error: `Backup failed: ${err.message || 'Unknown error'}` });
    }
  });
}
