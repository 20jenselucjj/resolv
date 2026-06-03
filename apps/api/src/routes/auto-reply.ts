import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { interpolate, getDefaultTemplates } from '../services/email-template-engine';
import { sendCustomEmail } from '../services/outbound-email';

// ─── Email variable helpers ─────────────────────────────────────────────────
function fmtPriority(p: string): string {
  const map: Record<string, string> = { low: 'P4 - Low', medium: 'P3 - Medium', high: 'P2 - High', critical: 'P1 - Critical' };
  return map[p] || p;
}
function fmtStatus(s: string): string {
  const map: Record<string, string> = { open: 'Open', in_progress: 'In Progress', waiting: 'Waiting on User', resolved: 'Resolved', closed: 'Closed' };
  return map[s] || s;
}
function fmtType(t: string): string {
  const map: Record<string, string> = { incident: 'Incident', service_request: 'Service Request', problem: 'Problem', change: 'Change Request' };
  return map[t] || t;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return 'None';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return d; }
}
function priorityColor(p: string): string {
  const map: Record<string, string> = { low: '#6b7280', medium: '#2563eb', high: '#f59e0b', critical: '#dc2626' };
  return map[p] || '#6b7280';
}
function statusColor(s: string): string {
  const map: Record<string, string> = { open: '#2563eb', in_progress: '#7c3aed', waiting: '#f59e0b', resolved: '#059669', closed: '#6b7280' };
  return map[s] || '#6b7280';
}
function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
  event: z.string().default('any'),
  delay_minutes: z.number().int().min(0).default(0),
  notify_watchers: z.boolean().default(false),
  suppress_duplicates: z.boolean().default(true),
  cooldown_minutes: z.number().int().min(0).default(60),
  template_id: z.string().optional().default(''),
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
            template_id VARCHAR(255) DEFAULT '',
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
      `INSERT INTO auto_reply_rules (name, enabled, description, conditions, reply_subject, reply_body, reply_from_email, send_to_requester, send_to_assignee, event, delay_minutes, notify_watchers, suppress_duplicates, cooldown_minutes, template_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [body.name, body.enabled, body.description, JSON.stringify(body.conditions),
       body.reply_subject, body.reply_body, body.reply_from_email,
       body.send_to_requester, body.send_to_assignee, body.event, body.delay_minutes,
       body.notify_watchers, body.suppress_duplicates, body.cooldown_minutes,
       body.template_id]
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
    if (body.event !== undefined) { updates.push(`event = $${paramIdx++}`); values.push(body.event); }
    if (body.delay_minutes !== undefined) { updates.push(`delay_minutes = $${paramIdx++}`); values.push(body.delay_minutes); }
    if (body.notify_watchers !== undefined) { updates.push(`notify_watchers = $${paramIdx++}`); values.push(body.notify_watchers); }
    if (body.suppress_duplicates !== undefined) { updates.push(`suppress_duplicates = $${paramIdx++}`); values.push(body.suppress_duplicates); }
    if (body.cooldown_minutes !== undefined) { updates.push(`cooldown_minutes = $${paramIdx++}`); values.push(body.cooldown_minutes); }
    if (body.template_id !== undefined) { updates.push(`template_id = $${paramIdx++}`); values.push(body.template_id); }

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
      // Look up additional ticket fields for email templates
      let ticketFull: any = null;
      try {
        const tResult = await pool.query('SELECT created_at, due_date, category_id, description FROM tickets WHERE id = $1', [ticket.id]);
        if (tResult.rows.length > 0) ticketFull = tResult.rows[0];
      } catch { /* optional */ }

      let arCategoryName = 'None';
      if (ticketFull?.category_id) {
        try {
          const c = await pool.query('SELECT name FROM categories WHERE id = $1', [ticketFull.category_id]);
          if (c.rows.length > 0) arCategoryName = c.rows[0].name;
        } catch { /* optional */ }
      }

      const variables = {
        ticket_id: ticket.number,
        ticket_title: ticket.title,
        user_name: requester.name,
        agent_name: assignee?.name || 'Support Team',
        ticket_url: `${webUrl}/dashboard/tickets/${ticket.id}`,
        priority: fmtPriority(ticket.priority),
        status: fmtStatus(ticket.status),
        requestor_name: requester.name,
        requestor_email: requester.email,
        assigned_to_name: assignee?.name || 'Unassigned',
        created_at: fmtDate(ticketFull?.created_at),
        due_date: fmtDate(ticketFull?.due_date),
        category: arCategoryName,
        ticket_type: fmtType(ticket.ticket_type),
        description: ticket.description || '',
        priority_color: priorityColor(ticket.priority),
        status_color: statusColor(ticket.status),
      };

      // If rule has a template_id, load the template and use its subject/body
      let useSubject = rule.reply_subject;
      let useBody = rule.reply_body;
      if (rule.template_id) {
        try {
          const tplResult = await pool.query("SELECT value FROM system_settings WHERE key = 'email_templates'");
          let foundTemplate: { subject: string; body: string } | null = null;
          if (tplResult.rows.length > 0) {
            try {
              const dbTemplates = JSON.parse(tplResult.rows[0].value);
              if (Array.isArray(dbTemplates)) {
                foundTemplate = dbTemplates.find((t: any) => t.id === rule.template_id || t.name === rule.template_id);
              }
            } catch { /* ignore parse errors */ }
          }
          // Fall back to defaults
          if (!foundTemplate) {
            const defaults = getDefaultTemplates();
            const id = rule.template_id.toLowerCase();
            foundTemplate = defaults.find(t => t.name.toLowerCase() === id || slugifyName(t.name) === id) || null;
          }
          if (foundTemplate) {
            useSubject = foundTemplate.subject;
            useBody = foundTemplate.body;
          }
        } catch { /* ignore lookup errors */ }
      }

      const subject = interpolate(useSubject, variables);
      const body = interpolate(useBody, variables);

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
