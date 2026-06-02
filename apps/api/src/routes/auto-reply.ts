import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { interpolate } from '../services/email-template-engine';
import { sendCustomEmail } from '../services/outbound-email';

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  enabled: z.boolean().default(true),
  description: z.string().default(''),
  conditions: z.object({
    ticket_type: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    category_id: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    keyword: z.string().optional(),
    time_before_hours: z.number().optional(),
  }).default({}),
  reply_subject: z.string().default('Re: Ticket #[TICKET_ID]'),
  reply_body: z.string().min(1),
  reply_from_email: z.string().default(''),
  send_to_requester: z.boolean().default(true),
  send_to_assignee: z.boolean().default(false),
});

const updateRuleSchema = createRuleSchema.partial();

export default async function autoReplyRoutes(fastify: FastifyInstance) {
  // List all auto-reply rules
  fastify.get('/admin/auto-replies', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM auto_reply_rules ORDER BY created_at DESC'
      );
      return reply.send({ data: result.rows });
    } catch {
      // Table may not exist yet — run migration or create it
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS auto_reply_rules (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            enabled BOOLEAN DEFAULT true,
            description TEXT DEFAULT '',
            conditions JSONB NOT NULL DEFAULT '{}',
            reply_subject VARCHAR(500) DEFAULT 'Re: Ticket #[TICKET_ID]',
            reply_body TEXT NOT NULL DEFAULT 'Thank you for contacting us.',
            reply_from_email VARCHAR(255) DEFAULT '',
            send_to_requester BOOLEAN DEFAULT true,
            send_to_assignee BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_enabled ON auto_reply_rules(enabled);
          INSERT INTO system_settings (key, value, updated_at)
          VALUES ('auto_reply_enabled', 'false', NOW())
          ON CONFLICT (key) DO NOTHING;
        `);
        const result = await pool.query('SELECT * FROM auto_reply_rules ORDER BY created_at DESC');
        return reply.send({ data: result.rows });
      } catch {
        return reply.send({ data: [] });
      }
    }
  });

  // Create auto-reply rule
  fastify.post('/admin/auto-replies', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = createRuleSchema.parse(request.body);

    const result = await pool.query(
      `INSERT INTO auto_reply_rules (name, enabled, description, conditions, reply_subject, reply_body, reply_from_email, send_to_requester, send_to_assignee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [body.name, body.enabled, body.description, JSON.stringify(body.conditions),
       body.reply_subject, body.reply_body, body.reply_from_email,
       body.send_to_requester, body.send_to_assignee]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // Update auto-reply rule
  fastify.patch('/admin/auto-replies/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRuleSchema.parse(request.body);

    // Check exists
    const existing = await pool.query('SELECT id FROM auto_reply_rules WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Auto-reply rule not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (body.name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(body.name); }
    if (body.enabled !== undefined) { updates.push(`enabled = $${paramIdx++}`); values.push(body.enabled); }
    if (body.description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(body.description); }
    if (body.conditions !== undefined) { updates.push(`conditions = $${paramIdx++}`); values.push(JSON.stringify(body.conditions)); }
    if (body.reply_subject !== undefined) { updates.push(`reply_subject = $${paramIdx++}`); values.push(body.reply_subject); }
    if (body.reply_body !== undefined) { updates.push(`reply_body = $${paramIdx++}`); values.push(body.reply_body); }
    if (body.reply_from_email !== undefined) { updates.push(`reply_from_email = $${paramIdx++}`); values.push(body.reply_from_email); }
    if (body.send_to_requester !== undefined) { updates.push(`send_to_requester = $${paramIdx++}`); values.push(body.send_to_requester); }
    if (body.send_to_assignee !== undefined) { updates.push(`send_to_assignee = $${paramIdx++}`); values.push(body.send_to_assignee); }

    updates.push(`updated_at = NOW()`);

    values.push(id);

    const result = await pool.query(
      `UPDATE auto_reply_rules SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    return reply.send({ data: result.rows[0] });
  });

  // Delete auto-reply rule
  fastify.delete('/admin/auto-replies/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query('DELETE FROM auto_reply_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Auto-reply rule not found' });
    }

    return reply.status(204).send();
  });

  // Toggle enable/disable
  fastify.patch('/admin/auto-replies/:id/toggle', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `UPDATE auto_reply_rules SET enabled = NOT enabled, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Auto-reply rule not found' });
    }

    return reply.send({ data: result.rows[0] });
  });
}

// ─── Trigger auto-replies for a ticket ──────────────────────────────────────
// Called after ticket creation. Checks all enabled rules and sends matching replies.
export async function triggerAutoReplies(
  ticket: {
    id: string;
    number: number;
    title: string;
    description?: string;
    priority: string;
    ticket_type: string;
    status: string;
    category_id?: string | null;
    created_by_id: string;
    assigned_to_id?: string | null;
  },
  requester: { id: string; email: string; name: string },
  assignee?: { id: string; email: string; name: string } | null
): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT * FROM auto_reply_rules WHERE enabled = true ORDER BY created_at ASC'
    );

    const rules = result.rows;
    if (rules.length === 0) return;

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    for (const rule of rules) {
      const conditions = rule.conditions || {};

      // Check ticket_type match
      if (conditions.ticket_type && Array.isArray(conditions.ticket_type) && conditions.ticket_type.length > 0) {
        if (!conditions.ticket_type.includes(ticket.ticket_type)) continue;
      }

      // Check priority match
      if (conditions.priority && Array.isArray(conditions.priority) && conditions.priority.length > 0) {
        if (!conditions.priority.includes(ticket.priority)) continue;
      }

      // Check category match
      if (conditions.category_id && Array.isArray(conditions.category_id) && conditions.category_id.length > 0) {
        if (!ticket.category_id || !conditions.category_id.includes(ticket.category_id)) continue;
      }

      // Check keyword match in title/description
      if (conditions.keyword && typeof conditions.keyword === 'string' && conditions.keyword.trim()) {
        const kw = conditions.keyword.toLowerCase();
        const searchText = `${ticket.title} ${ticket.description || ''}`.toLowerCase();
        if (!searchText.includes(kw)) continue;
      }

      // Build template variables
      const variables = {
        ticket_id: ticket.number,
        ticket_title: ticket.title,
        user_name: requester.name,
        agent_name: assignee?.name || 'Support Team',
        ticket_url: `${webUrl}/dashboard/tickets/${ticket.id}`,
        priority: ticket.priority,
        status: ticket.status,
      };

      const subject = interpolate(rule.reply_subject, variables);
      const body = interpolate(rule.reply_body, variables);

      // Send to requester
      if (rule.send_to_requester && requester.email) {
        sendCustomEmail(
          requester.email,
          requester.name,
          subject,
          body,
          ticket.id
        ).catch(() => {});
      }

      // Send to assignee
      if (rule.send_to_assignee && assignee?.email && assignee.email !== requester.email) {
        sendCustomEmail(
          assignee.email,
          assignee.name,
          subject,
          body,
          ticket.id
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Auto-reply trigger error:', err);
  }
}
