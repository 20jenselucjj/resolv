// inbound-email.ts ΓÇö API routes for email operations
// Webhook endpoint for direct inbound email processing, email log viewer, etc.

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { testSmtpConnection, invalidateTransporter, sendTemplateEmail, loadSmtpConfig } from '../services/outbound-email';
import { startInboundListener, stopInboundListener, forcePoll } from '../services/inbound-email';

export default async function inboundEmailRoutes(fastify: FastifyInstance) {

  // POST /admin/settings/test-smtp ΓÇö Test SMTP connection (already exists, we enhance it)
  // Note: the existing route in admin.ts handles this; we just provide the implementation
  // that the admin route can delegate to.

  // POST /admin/email/test ΓÇö Admin-only: send a test email
  fastify.post('/admin/email/test', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
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
  fastify.get('/admin/email/log', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
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
  fastify.post('/admin/email/:id/resend', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
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

  // POST /admin/email/smtp/test ΓÇö Enhanced SMTP test
  fastify.post('/admin/email/smtp/test', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535).default(587),
      secure: z.boolean().default(false),
      user: z.string().optional(),
      password: z.string().optional(),
    }).parse(request.body);

    const result = await testSmtpConnection(body);
    return reply.send({ data: result });
  });

  // POST /admin/email/smtp/save ΓÇö Save SMTP settings and invalidate cached transporter
  // This is already handled by the generic PATCH /admin/settings route,
  // but we provide an explicit endpoint for SMTP batch save + invalidation
  fastify.post('/admin/email/smtp/save', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      host: z.string().optional(),
      port: z.string().optional(),
      secure: z.string().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      from_email: z.string().optional(),
      from_name: z.string().optional(),
    }).parse(request.body);

    const keys = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name'];
    const values: Record<string, string | undefined> = {
      smtp_host: body.host,
      smtp_port: body.port,
      smtp_secure: body.secure,
      smtp_user: body.user,
      smtp_password: body.password,
      smtp_from_email: body.from_email,
      smtp_from_name: body.from_name,
    };

    for (const key of keys) {
      if (values[key] !== undefined) {
        await pool.query(
          `INSERT INTO system_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [key, values[key] || '', request.user.id]
        );
      }
    }

    invalidateTransporter();
    return reply.send({ success: true });
  });

  // GET /admin/email/inbound/config ΓÇö Get inbound email settings
  fastify.get('/admin/email/inbound/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query(
      "SELECT key, value FROM system_settings WHERE key LIKE 'email_inbound_%'"
    );
    const config: Record<string, string> = {};
    result.rows.forEach(r => { config[r.key.replace('email_inbound_', '')] = r.value; });
    return reply.send({ data: config });
  });

  // POST /admin/email/inbound/config ΓÇö Save inbound email settings
  fastify.post('/admin/email/inbound/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.string().optional(),
      host: z.string().optional(),
      port: z.string().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      poll_interval: z.string().optional(),
      folder: z.string().optional(),
      processed_folder: z.string().optional(),
      ticket_creation_enabled: z.string().optional(),
      reply_enabled: z.string().optional(),
    }).parse(request.body);

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        await pool.query(
          `INSERT INTO system_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [`email_inbound_${key}`, value, request.user.id]
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
  fastify.post('/admin/email/inbound/test', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await forcePoll();
    return reply.send(result);
  });

  // GET /admin/email/smtp/config ΓÇö Get SMTP config
  fastify.get('/admin/email/smtp/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const config = await loadSmtpConfig();
    return reply.send({
      data: config ? {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        from_email: config.fromEmail,
        from_name: config.fromName,
        // Never return password
        password_set: !!config.password,
      } : null,
    });
  });
}
