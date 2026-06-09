// inbound-email.ts ΓÇö API routes for email operations
// Gmail API inbound email processing via OAuth, email log viewer, SMTP config.

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { invalidateTransporter, sendTemplateEmail } from '../services/outbound-email';
import { startInboundListener, stopInboundListener, forcePoll, getGmailStatus } from '../services/inbound-email';

export default async function inboundEmailRoutes(fastify: FastifyInstance) {

  // POST /admin/settings/test-smtp ΓÇö Test SMTP connection (already exists, we enhance it)
  // Note: the existing route in admin.ts handles this; we just provide the implementation
  // that the admin route can delegate to.

  // POST /admin/email/test ΓÇö Admin-only: send a test email
  fastify.post('/admin/email/test', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = z.object({
      to_email: z.string().email(),
    }).parse(request.body);

    const result = await sendTemplateEmail(
      body.to_email,
      '',
      'Ticket Created',
      {
        ticket_id: 9999,
        ticket_title: 'Test Email from Resolv',
        user_name: 'Admin',
        ticket_url: process.env.WEB_URL || 'http://localhost:3000',
      }
    );

    if (result.success) {
      return reply.send({ success: true, messageId: result.messageId });
    }
    return reply.status(500).send({ error: result.error || 'Failed to send test email' });
  });

  // GET /admin/email/log ΓÇö View email log
  fastify.get('/admin/email/log', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.ticket_id) {
      whereClause += ` AND el.ticket_id = $${paramIdx++}`;
      params.push(query.ticket_id);
    }
    if (query.direction) {
      whereClause += ` AND el.direction = $${paramIdx++}`;
      params.push(query.direction);
    }
    if (query.status) {
      whereClause += ` AND el.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.search) {
      whereClause += ` AND (el.subject ILIKE $${paramIdx} OR el.recipient_email ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM email_log el WHERE 1=1 ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT el.*, t.number as ticket_number, t.title as ticket_title
       FROM email_log el
       LEFT JOIN tickets t ON el.ticket_id = t.id
       WHERE 1=1 ${whereClause}
       ORDER BY el.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    );

    return reply.send({
      data: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  });

  // POST /admin/email/resend ΓÇö Retry sending a failed email
  fastify.post('/admin/email/:id/resend', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const logResult = await pool.query('SELECT * FROM email_log WHERE id = $1', [id]);
    if (logResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Email log entry not found' });
    }
    const logEntry = logResult.rows[0];

    // Simple resend: try sending again with the same content
    const result = await sendTemplateEmail(
      logEntry.recipient_email,
      '',
      'Ticket Created', // approximate ΓÇö we could store template name in email_log
      {
        ticket_id: logEntry.ticket_id,
        user_name: logEntry.recipient_email,
        ticket_url: process.env.WEB_URL || 'http://localhost:3000',
      }
    );

    if (result.success) {
      return reply.send({ success: true, messageId: result.messageId });
    }
    return reply.status(500).send({ error: result.error || 'Failed to resend' });
  });

  // POST /admin/email/smtp/save ΓÇö Save SMTP settings and invalidate cached transporter
  // This is already handled by the generic PATCH /admin/settings route,
  // but we provide an explicit endpoint for SMTP batch save + invalidation
  fastify.post('/admin/email/smtp/save', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    // No-op: outbound email is now configured via Google Workspace OAuth.
    invalidateTransporter();
    return reply.send({ success: true });
  });
  // GET /admin/email/inbound/config ΓÇö Get inbound email settings and Gmail connection status
  fastify.get('/admin/email/inbound/config', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query(
      "SELECT key, value FROM system_settings WHERE key LIKE 'email_inbound_%' OR key LIKE 'email_%'"
    );
    const config: Record<string, string> = {};
    result.rows.forEach(r => { config[r.key.replace('email_inbound_', '').replace('email_', '')] = r.value; });

    // Remap address key to inbound_email_address for the frontend
    if (config.address !== undefined) {
      config.inbound_email_address = config.address;
      delete config.address;
    }

    // Get Gmail OAuth connection status
    const gmailStatus = await getGmailStatus();

    return reply.send({ data: { ...config, gmail_status: gmailStatus } });
  });

  // POST /admin/email/inbound/config ΓÇö Save inbound email settings (Gmail API via OAuth)
  fastify.post('/admin/email/inbound/config', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = z.object({
      enabled: z.string().optional(),
      protocol: z.string().optional(),
      poll_interval: z.string().optional(),
      label: z.string().optional(),
      ticket_creation_enabled: z.string().optional(),
      reply_enabled: z.string().optional(),
      inbound_email_address: z.string().optional(),
    }).parse(request.body);

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        // Protocol is stored as email_inbound_protocol, others as email_inbound_<key>
        const settingKey = key === 'protocol'
          ? 'email_inbound_protocol'
          : key === 'inbound_email_address'
            ? 'email_inbound_address'
            : (key.startsWith('ticket_') || key.startsWith('reply_'))
              ? `email_${key}`
              : `email_inbound_${key}`;
        await pool.query(
          `INSERT INTO system_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [settingKey, value, request.user.id]
        );
      }
    }

    // Restart listener if enabled
    await stopInboundListener();
    if (body.enabled === 'true') {
      await startInboundListener();
    }

    return reply.send({ success: true });
  });

  // POST /admin/email/inbound/test ΓÇö Force an inbound email poll
  fastify.post('/admin/email/inbound/test', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await forcePoll();
    return reply.send(result);
  });

  // GET /admin/email/inbound/parsing — Get email parsing configuration
  fastify.get('/admin/email/inbound/parsing', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'email_parsing_config'"
    );
    let config = { require_known_sender: true, default_priority: 'medium', default_type: 'incident', default_status: 'open', auto_reopen_on_reply: false };
    if (result.rows.length > 0) {
      try {
        config = JSON.parse(result.rows[0].value);
      } catch { /* use defaults */ }
    }
    return reply.send({ data: config });
  });

  // POST /admin/email/inbound/parsing — Save email parsing configuration
  fastify.post('/admin/email/inbound/parsing', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = z.object({
      require_known_sender: z.boolean().optional(),
      default_priority: z.string().optional(),
      default_type: z.string().optional(),
      default_status: z.string().optional(),
      domain_whitelist: z.array(z.string()).optional(),
      priority_keywords: z.record(z.array(z.string())).optional(),
      type_keywords: z.record(z.array(z.string())).optional(),
      auto_reopen_on_reply: z.boolean().optional(),
    }).parse(request.body);

    // Read existing config
    const existing = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'email_parsing_config'"
    );
    let config: Record<string, any> = { require_known_sender: true, default_priority: 'medium', default_type: 'incident', default_status: 'open', auto_reopen_on_reply: false };
    if (existing.rows.length > 0) {
      try {
        config = JSON.parse(existing.rows[0].value);
      } catch { /* use defaults */ }
    }

    // Merge with new values
    if (body.require_known_sender !== undefined) config.require_known_sender = body.require_known_sender;
    if (body.default_priority !== undefined) config.default_priority = body.default_priority;
    if (body.default_type !== undefined) config.default_type = body.default_type;
    if (body.default_status !== undefined) config.default_status = body.default_status;
    if (body.domain_whitelist !== undefined) config.domain_whitelist = body.domain_whitelist;
    if (body.priority_keywords !== undefined) config.priority_keywords = body.priority_keywords;
    if (body.type_keywords !== undefined) config.type_keywords = body.type_keywords;
    if (body.auto_reopen_on_reply !== undefined) config.auto_reopen_on_reply = body.auto_reopen_on_reply;

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      ['email_parsing_config', JSON.stringify(config), (request.user as any).id]
    );

    return reply.send({ success: true });
  });

  // GET /admin/email/ticket-type-defaults
  fastify.get('/admin/email/ticket-type-defaults', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'ticket_type_defaults'"
    );
    let defaults = {
      incident: { due_hours: 24 },
      service_request: { due_hours: 72 },
      problem: { due_hours: 168 },
      change: { due_hours: 336 },
    };
    if (result.rows.length > 0) {
      try {
        defaults = JSON.parse(result.rows[0].value);
      } catch { /* use defaults */ }
    }
    return reply.send({ data: defaults });
  });

  // POST /admin/email/ticket-type-defaults
  fastify.post('/admin/email/ticket-type-defaults', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = z.object({
      ticket_type_defaults: z.record(z.string(), z.object({
        due_hours: z.number().min(1).max(8760),
      })),
    }).parse(request.body);

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      ['ticket_type_defaults', JSON.stringify(body.ticket_type_defaults), (request.user as any).id]
    );

    return reply.send({ success: true });
  });

  // GET /admin/email/smtp/config ΓÇö Get SMTP config
  fastify.get('/admin/email/smtp/config', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { loadOutboundOAuthConfig } = await import('../services/outbound-email');
    const config = await loadOutboundOAuthConfig();
    return reply.send({
      data: config ? {
        provider: config.provider,
        connected: config.connected,
        email: config.email,
        tokenExpiresAt: config.tokenExpiresAt,
        client_id_preview: config.clientId ? config.clientId.substring(0, 8) + '...' : null,
      } : null,
    });
  });
}
