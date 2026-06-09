import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';
import { syncTicketToKnowledgeBase } from './ai-training';
import { sendTemplateEmail, isEmailEnabledForEvent } from '../services/outbound-email';
import type { EmailAttachment } from '../services/outbound-email';
import { dispatchNotifications } from '../services/notification-runner';
import { autoClassifyTicket } from '../services/workflow-engine';
import fs from 'fs';

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

const createTicketSchema = z.object({
  title: z.string().min(3).max(500),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']).default('incident'),
  tags: z.array(z.string()).default([]),
  assigned_to_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  custom_fields: z.array(z.object({
    definition_id: z.string().uuid(),
    value_text: z.string().nullable().optional(),
    value_number: z.number().nullable().optional(),
    value_date: z.string().nullable().optional(),
    value_boolean: z.boolean().nullable().optional(),
    value_array: z.array(z.string()).optional(),
  })).optional(),
});

const updateTicketSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']).optional(),
  tags: z.array(z.string()).optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  created_by_id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  close_notes: z.string().nullable().optional(),
  send_email: z.boolean().optional(),
  asset_id: z.string().uuid().nullable().optional(),
});

async function createNotification(db: any, userId: string, type: string, title: string, body: string, ticketId?: string) {
  await db.query(
    'INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, $2, $3, $4, $5)',
    [userId, type, title, body, ticketId || null]
  );
}

export default async function ticketRoutes(fastify: FastifyInstance) {

  // List tickets with filters
  fastify.get('/tickets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(25),
      status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assignedToMe: z.string().optional(),
      search: z.string().max(200).optional(),
      type: z.enum(['incident', 'service_request', 'problem', 'change']).optional(),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Row-level auth for GET /tickets
    if (request.user.role === 'user') {
      whereClause += ` AND (t.created_by_id = $${paramIdx} OR t.assigned_to_id = $${paramIdx})`;
      params.push(request.user.id);
      paramIdx++;
    }

    if (query.status) {
      whereClause += ` AND t.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.priority) {
      whereClause += ` AND t.priority = $${paramIdx++}`;
      params.push(query.priority);
    }
    if (query.type) {
      whereClause += ` AND t.ticket_type = $${paramIdx++}`;
      params.push(query.type);
    }
    if (query.assignedToMe === 'true') {
      whereClause += ` AND t.assigned_to_id = $${paramIdx++}`;
      params.push(request.user.id);
    }
    if (query.search) {
      // Also search by ticket number (exact match) and tags
      whereClause += ` AND (t.title ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx} OR t.number::text ILIKE $${paramIdx} OR EXISTS (SELECT 1 FROM unnest(t.tags) AS tag WHERE tag ILIKE $${paramIdx}))`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tickets t 
       LEFT JOIN users u1 ON t.created_by_id = u1.id
       LEFT JOIN users u2 ON t.assigned_to_id = u2.id
       LEFT JOIN categories c ON t.category_id = c.id
       ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT t.*, 
        u1.name as created_by_name, u1.email as created_by_email,
        u2.name as assigned_to_name, u2.email as assigned_to_email, u2.avatar_url as assigned_to_avatar,
        c.name as category_name, c.color as category_color,
        a.name as asset_name
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by_id = u1.id
       LEFT JOIN users u2 ON t.assigned_to_id = u2.id
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN assets a ON t.asset_id = a.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, query.pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  // Get single ticket
  fastify.get('/tickets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT t.*, 
        u1.name as created_by_name, u1.email as created_by_email, u1.avatar_url as created_by_avatar,
        u2.name as assigned_to_name, u2.email as assigned_to_email, u2.avatar_url as assigned_to_avatar,
        c.name as category_name, c.color as category_color,
        a.name as asset_name,
        (SELECT u.name FROM ticket_activity ta 
         JOIN users u ON ta.actor_id = u.id 
         WHERE ta.ticket_id = t.id AND ta.action = 'status_changed' AND ta.new_value = 'closed'
         ORDER BY ta.created_at DESC LIMIT 1) as closed_by_name
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by_id = u1.id
       LEFT JOIN users u2 ON t.assigned_to_id = u2.id
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN assets a ON t.asset_id = a.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    // Row-level auth check
    if (request.user.role === 'user' && ticket.created_by_id !== request.user.id && ticket.assigned_to_id !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Get comments
    let commentsQuery = `
      SELECT tc.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
      FROM ticket_comments tc
      JOIN users u ON tc.author_id = u.id
      WHERE tc.ticket_id = $1
    `;
    const commentsParams: any[] = [id];
    
    if (request.user.role === 'user') {
      commentsQuery += ` AND tc.is_internal = false`;
    }
    
    commentsQuery += ` ORDER BY tc.created_at DESC`;

    const comments = await pool.query(commentsQuery, commentsParams);

    // Get activity
    const activity = await pool.query(
      `SELECT ta.*, u.name as actor_name
       FROM ticket_activity ta
       JOIN users u ON ta.actor_id = u.id
       WHERE ta.ticket_id = $1
       ORDER BY ta.created_at ASC`,
      [id]
    );

    // Get custom field values
    let customFields: any[] = [];
    try {
      const cfResult = await pool.query(
        `SELECT cfv.*, cfd.name, cfd.field_key, cfd.field_type, cfd.options, cfd.required
         FROM custom_field_values cfv
         JOIN custom_field_definitions cfd ON cfd.id = cfv.definition_id
         WHERE cfv.entity_id = $1 AND cfd.entity_type = 'ticket' AND cfd.is_active = true`,
        [id]
      );
      customFields = cfResult.rows;
    } catch { /* custom fields are optional */ }

    // Get linked problems
    const linkedProblems = await pool.query(
      `SELECT p.id, p.number, p.title, p.status, pil.link_type
       FROM problem_incident_links pil
       JOIN problems p ON p.id = pil.problem_id
       WHERE pil.incident_id = $1`,
      [id]
    );

    return reply.send({
      data: {
        ...ticket,
        comments: comments.rows,
        activity: activity.rows,
        custom_fields: customFields,
        linked_problems: linkedProblems.rows,
      },
    });
  });

  // Create ticket
  fastify.post('/tickets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createTicketSchema.parse(request.body);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Auto-classify ticket based on keywords if no explicit type set
      let ticketType: string = body.ticket_type;
      let ticketPriority: string = body.priority;

      // Classification only runs for default 'incident' or unset type
      if (!body.ticket_type || body.ticket_type === 'incident') {
        const classification = await autoClassifyTicket(body.title, body.description, body.ticket_type);
        if (classification?.ticket_type) {
          ticketType = classification.ticket_type;
        }
        if (classification?.priority) {
          const pInt = parseInt(classification.priority);
          if (pInt >= 80) ticketPriority = 'critical';
          else if (pInt >= 50) ticketPriority = 'high';
          else if (pInt >= 20) ticketPriority = 'medium';
        }
      }

      const result = await client.query(
        `INSERT INTO tickets (title, description, priority, ticket_type, tags, created_by_id, assigned_to_id, category_id, due_date, asset_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [body.title, body.description, ticketPriority, ticketType as string, body.tags, request.user.id, body.assigned_to_id || null, body.category_id || null, body.due_date || null, body.asset_id || null]
      );

      const rawTicket = result.rows[0];

      // Populate joins
      const populatedResult = await client.query(
        `SELECT t.*, 
          u1.name as created_by_name, u1.email as created_by_email,
          u2.name as assigned_to_name, u2.email as assigned_to_email, u2.avatar_url as assigned_to_avatar,
          c.name as category_name, c.color as category_color,
          a.name as asset_name
         FROM tickets t
         LEFT JOIN users u1 ON t.created_by_id = u1.id
         LEFT JOIN users u2 ON t.assigned_to_id = u2.id
         LEFT JOIN categories c ON t.category_id = c.id
         LEFT JOIN assets a ON t.asset_id = a.id
         WHERE t.id = $1`,
        [rawTicket.id]
      );
      const ticket = populatedResult.rows[0];

      // Log activity
      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
         VALUES ($1, $2, 'created', $3)`,
        [ticket.id, request.user.id, ticket.status]
      );

      // Create notification for assigned user
      if (ticket.assigned_to_id) {
        await createNotification(
          client,
          ticket.assigned_to_id,
          'ticket_assigned',
          `You have been assigned ticket #${ticket.number}: ${ticket.title}`,
          '',
          ticket.id
        );
      } else {
        // Unassigned ticket — notify all agents and admins
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, ticket_id)
           SELECT id, 'ticket_created', $1, $2, $3 FROM users
           WHERE role IN ('admin', 'agent') AND is_active = true`,
          [`New unassigned ticket #${ticket.number}: ${ticket.title}`, `Created by ${request.user.name}`, ticket.id]
        );
      }

      // Save custom field values if provided
      if (body.custom_fields && Array.isArray(body.custom_fields)) {
        for (const cf of body.custom_fields) {
          await client.query(
            `INSERT INTO custom_field_values (definition_id, entity_id, value_text, value_number, value_date, value_boolean, value_array)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (definition_id, entity_id) DO UPDATE SET value_text = $3, value_number = $4, value_date = $5, value_boolean = $6, value_array = $7`,
            [cf.definition_id, ticket.id, cf.value_text || null, cf.value_number || null, cf.value_date || null, cf.value_boolean || null, cf.value_array || '{}']
          );
        }
      }

      await client.query('COMMIT');

      // Fetch custom fields for response
      let customFields: any[] = [];
      try {
        const cfResult = await pool.query(
          `SELECT cfv.*, cfd.name, cfd.field_key, cfd.field_type, cfd.options, cfd.required
           FROM custom_field_values cfv
           JOIN custom_field_definitions cfd ON cfd.id = cfv.definition_id
           WHERE cfv.entity_id = $1 AND cfd.entity_type = 'ticket' AND cfd.is_active = true`,
          [ticket.id]
        );
        customFields = cfResult.rows;
      } catch { /* custom fields are optional */ }

      // Emit real-time event
      fastify.io.emit('ticket:created', { ticket });
      fastify.io.emit('reports:data-updated', {});

      // Notify assigned user's personal room via socket
      if (ticket.assigned_to_id) {
        fastify.io.to(`user:${ticket.assigned_to_id}`).emit('notification:new', { ticketId: ticket.id });
      } else {
        // Notify all agents/admins via socket for unassigned tickets
        // Broadcast to a 'staff' room when agents connect, or emit to all connected clients
        fastify.io.emit('notification:new', { ticketId: ticket.id, role: 'agent' });
      }

      // Fire-and-forget: dispatch notifications through the pipeline
      dispatchNotifications({
        type: 'ticket_created',
        ticket: { id: ticket.id, number: ticket.number, title: ticket.title, description: ticket.description, priority: ticket.priority, status: ticket.status, ticket_type: ticket.ticket_type, category_id: ticket.category_id, due_date: ticket.due_date, created_at: ticket.created_at, created_by_id: ticket.created_by_id, assigned_to_id: ticket.assigned_to_id },
        actor: { id: request.user.id, name: request.user.name, email: request.user.email },
      }).catch(() => {});

      return reply.status(201).send({ data: { ...ticket, custom_fields: customFields } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Bulk update tickets
  fastify.patch('/tickets/bulk', { preHandler: [fastify.requirePermission('assign_tickets')] }, async (request, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      updates: z.object({
        status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigned_to_id: z.string().uuid().nullable().optional(),
        close_notes: z.string().optional(),
        send_email: z.boolean().optional(),
      }),
    }).parse(request.body);

    const { ids, updates } = body;

    if (updates.status === 'closed' && !updates.close_notes?.trim()) {
      return reply.status(400).send({ error: 'Closing note is required for bulk close' });
    }

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (updates.status !== undefined) { setClauses.push(`status = $${paramIdx++}`); params.push(updates.status); }
    if (updates.priority !== undefined) { setClauses.push(`priority = $${paramIdx++}`); params.push(updates.priority); }
    if (updates.assigned_to_id !== undefined) { setClauses.push(`assigned_to_id = $${paramIdx++}`); params.push(updates.assigned_to_id); }
    if (updates.close_notes !== undefined) { setClauses.push(`close_notes = $${paramIdx++}`); params.push(updates.close_notes); }
    if (updates.status === 'closed') { setClauses.push(`closed_at = NOW()`); }
    if (updates.status === 'resolved') { setClauses.push(`resolved_at = NOW()`); }

    if (setClauses.length === 0) {
      return reply.status(400).send({ error: 'No updates provided' });
    }

    // Build the IN clause for ids
    const idPlaceholders = ids.map((_, i) => `$${paramIdx + i}`).join(', ');
    params.push(...ids);

    await pool.query(
      `UPDATE tickets SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders})`,
      params
    );

    fastify.io.emit('tickets:bulk_updated', { ids, updates });
    fastify.io.emit('reports:data-updated', {});
    return reply.send({ message: `Updated ${ids.length} tickets` });
  });

  // Update ticket
  fastify.patch('/tickets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTicketSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current ticket
      const current = await client.query('SELECT * FROM tickets WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Ticket not found' });
      }

      const ticket = current.rows[0];

      // Require close_notes when closing
      if (body.status === 'closed' && !body.close_notes?.trim()) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Closing note is required' });
      }

      // Row-level auth check
      if (request.user.role === 'user') {
        if (ticket.created_by_id !== request.user.id && ticket.assigned_to_id !== request.user.id) {
          await client.query('ROLLBACK');
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (body.title !== undefined) { updates.push(`title = $${paramIdx++}`); params.push(body.title); }
      if (body.description !== undefined) { updates.push(`description = $${paramIdx++}`); params.push(body.description); }
      if (body.status !== undefined) { updates.push(`status = $${paramIdx++}`); params.push(body.status); }
      if (body.priority !== undefined) { updates.push(`priority = $${paramIdx++}`); params.push(body.priority); }
      if (body.ticket_type !== undefined) { updates.push(`ticket_type = $${paramIdx++}`); params.push(body.ticket_type); }
      if (body.tags !== undefined) { updates.push(`tags = $${paramIdx++}`); params.push(body.tags); }
      if (body.assigned_to_id !== undefined) { updates.push(`assigned_to_id = $${paramIdx++}`); params.push(body.assigned_to_id); }
      if (body.created_by_id !== undefined) { updates.push(`created_by_id = $${paramIdx++}`); params.push(body.created_by_id); }
      if (body.category_id !== undefined) { updates.push(`category_id = $${paramIdx++}`); params.push(body.category_id); }
      if (body.due_date !== undefined) { updates.push(`due_date = $${paramIdx++}`); params.push(body.due_date); }
      if (body.asset_id !== undefined) { updates.push(`asset_id = $${paramIdx++}`); params.push(body.asset_id); }
      if (body.close_notes !== undefined) { updates.push(`close_notes = $${paramIdx++}`); params.push(body.close_notes); }
      if (body.status === 'resolved') { updates.push(`resolved_at = NOW()`); }
      if (body.status === 'closed') { updates.push(`closed_at = NOW()`); }

      // When reopening a closed/resolved ticket, preserve close_notes as an
      // internal note and clear closing metadata
      let preservedComment: any = null;
      const closedStatuses = ['closed', 'resolved'];
      const openStatuses = ['open', 'in_progress', 'waiting'];
      const isReopening = body.status
        && body.status !== ticket.status
        && closedStatuses.includes(ticket.status)
        && openStatuses.includes(body.status);
      if (isReopening) {
        if (ticket.close_notes) {
          const commentResult = await client.query(
            `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal)
             VALUES ($1, $2, $3, true)
             RETURNING *`,
            [id, request.user.id, ticket.close_notes]
          );
          preservedComment = {
            ...commentResult.rows[0],
            author_name: request.user.name,
            author_email: request.user.email,
          };
        }
        updates.push('close_notes = NULL');
        updates.push('closed_at = NULL');
        updates.push('resolved_at = NULL');
      }

      if (updates.length === 0) {
        await client.query('COMMIT');
        return reply.send({ data: ticket });
      }

      params.push(id);
      const result = await client.query(
        `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params
      );

      const rawUpdated = result.rows[0];

      // Populate joins
      const populatedResult = await client.query(
        `SELECT t.*, 
          u1.name as created_by_name, u1.email as created_by_email, u1.avatar_url as created_by_avatar,
          u2.name as assigned_to_name, u2.email as assigned_to_email, u2.avatar_url as assigned_to_avatar,
          c.name as category_name, c.color as category_color,
          a.name as asset_name
         FROM tickets t
         LEFT JOIN users u1 ON t.created_by_id = u1.id
         LEFT JOIN users u2 ON t.assigned_to_id = u2.id
         LEFT JOIN categories c ON t.category_id = c.id
         LEFT JOIN assets a ON t.asset_id = a.id
         WHERE t.id = $1`,
        [rawUpdated.id]
      );
      const updated = populatedResult.rows[0];

      // Log activity for status changes
      if (body.status && body.status !== ticket.status) {
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value)
           VALUES ($1, $2, 'status_changed', $3, $4)`,
          [id, request.user.id, ticket.status, body.status]
        );
      }

      // Create in-app notifications for all ticket updates
      // In ITSM, the notification panel is an activity log — notify both reporter and assignee
      const notifiedUsers = new Set<string>();

      let notifType = 'ticket_updated';
      let notifTitle = `Ticket #${updated.number} was updated: ${updated.title}`;

      if (body.status && body.status !== ticket.status) {
        notifType = 'status_changed';
        if (body.status === 'resolved') {
          notifType = 'ticket_resolved';
          notifTitle = `Your ticket #${updated.number} has been resolved`;
        } else if (body.status === 'closed') {
          notifType = 'ticket_closed';
          notifTitle = `Your ticket #${updated.number} has been closed`;
        } else {
          notifTitle = `Status changed to "${body.status}" on ticket #${updated.number}: ${updated.title}`;
        }
      }

      // Notify the ticket reporter
      await createNotification(client, updated.created_by_id, notifType, notifTitle, '', updated.id);
      notifiedUsers.add(updated.created_by_id);

      // Notify the assignee if different from reporter
      if (updated.assigned_to_id && !notifiedUsers.has(updated.assigned_to_id)) {
        let assigneeType = notifType;
        let assigneeTitle = notifTitle;
        // For assignment changes, the assignee gets a specific message
        if (body.assigned_to_id !== undefined && body.assigned_to_id !== ticket.assigned_to_id) {
          assigneeType = 'ticket_assigned';
          assigneeTitle = `You have been assigned ticket #${updated.number}: ${updated.title}`;
        }
        await createNotification(client, updated.assigned_to_id, assigneeType, assigneeTitle, '', updated.id);
      }

      await client.query('COMMIT');

      // Include who closed the ticket in the response (for the closing note card)
      if (body.status === 'closed') {
        (updated as any).closed_by_name = request.user.name;
      }

      // Emit real-time event for the preserved close_notes comment
      if (preservedComment) {
        fastify.io.emit(`ticket:comment:${id}`, { comment: preservedComment });
      }

      // Emit real-time event
      fastify.io.emit(`ticket:updated:${id}`, { ticket: updated });
      fastify.io.emit('ticket:updated', { ticket: updated });
      fastify.io.emit('reports:data-updated', {});

      // Emit real-time notification:new for users who got in-app notifications
      fastify.io.to(`user:${updated.created_by_id}`).emit('notification:new', { ticketId: id });
      if (updated.assigned_to_id && !notifiedUsers.has(updated.assigned_to_id)) {
        fastify.io.to(`user:${updated.assigned_to_id}`).emit('notification:new', { ticketId: id });
      }

      // Auto-sync closed/resolved tickets into AI knowledge base
      if (body.status === 'closed' || body.status === 'resolved') {
        syncTicketToKnowledgeBase(id, request.user.id).catch(console.error);
      }

      // Fire-and-forget: dispatch notifications through the pipeline
      if (body.status === 'resolved') {
        dispatchNotifications({
          type: 'ticket_resolved',
          ticket: { id: updated.id, number: updated.number, title: updated.title, description: updated.description, priority: updated.priority, status: updated.status, ticket_type: updated.ticket_type, category_id: updated.category_id, due_date: updated.due_date, created_at: updated.created_at, created_by_id: updated.created_by_id, assigned_to_id: updated.assigned_to_id },
          previousTicket: { status: ticket.status, priority: ticket.priority, assigned_to_id: ticket.assigned_to_id },
          actor: { id: request.user.id, name: request.user.name, email: request.user.email },
        }).catch(() => {});
      } else if (body.status === 'closed') {
        dispatchNotifications({
          type: 'ticket_closed',
          ticket: { id: updated.id, number: updated.number, title: updated.title, description: updated.description, priority: updated.priority, status: updated.status, ticket_type: updated.ticket_type, category_id: updated.category_id, due_date: updated.due_date, created_at: updated.created_at, created_by_id: updated.created_by_id, assigned_to_id: updated.assigned_to_id },
          previousTicket: { status: ticket.status, priority: ticket.priority, assigned_to_id: ticket.assigned_to_id },
          actor: { id: request.user.id, name: request.user.name, email: request.user.email },
        }).catch(() => {});
      } else if (body.assigned_to_id && body.assigned_to_id !== ticket.assigned_to_id) {
        // Assignment/reassignment
        let oldAssignee = undefined;
        let newAssignee = undefined;
        if (ticket.assigned_to_id) {
          const oldA = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [ticket.assigned_to_id]);
          if (oldA.rows.length > 0) oldAssignee = oldA.rows[0];
        }
        if (body.assigned_to_id) {
          const newA = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [body.assigned_to_id]);
          if (newA.rows.length > 0) newAssignee = newA.rows[0];
        }
        dispatchNotifications({
          type: ticket.assigned_to_id ? 'ticket_reassigned' : 'ticket_assigned',
          ticket: { id: updated.id, number: updated.number, title: updated.title, description: updated.description, priority: updated.priority, status: updated.status, ticket_type: updated.ticket_type, category_id: updated.category_id, due_date: updated.due_date, created_at: updated.created_at, created_by_id: updated.created_by_id, assigned_to_id: updated.assigned_to_id },
          previousTicket: { assigned_to_id: ticket.assigned_to_id },
          actor: { id: request.user.id, name: request.user.name, email: request.user.email },
          oldAssignee,
          newAssignee,
        }).catch(() => {});
      } else if (body.status || body.priority || body.title || body.description) {
        // Generic update
        dispatchNotifications({
          type: body.status && body.status !== ticket.status ? 'status_changed' : 'ticket_updated',
          ticket: { id: updated.id, number: updated.number, title: updated.title, description: updated.description, priority: updated.priority, status: updated.status, ticket_type: updated.ticket_type, category_id: updated.category_id, due_date: updated.due_date, created_at: updated.created_at, created_by_id: updated.created_by_id, assigned_to_id: updated.assigned_to_id },
          previousTicket: { status: ticket.status, priority: ticket.priority, assigned_to_id: ticket.assigned_to_id },
          actor: { id: request.user.id, name: request.user.name, email: request.user.email },
        }).catch(() => {});
      }

      return reply.send({ data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Delete ticket (admin only)
  fastify.delete('/tickets/:id', { preHandler: [fastify.requirePermission('delete_tickets')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
    fastify.io.emit('ticket:deleted', { id });
    fastify.io.emit('reports:data-updated', {});
    return reply.status(204).send();
  });

  // Bulk delete tickets (admin only)
  fastify.post('/tickets/bulk-delete', { preHandler: [fastify.requirePermission('delete_tickets')] }, async (request, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    }).parse(request.body);

    const { ids } = body;
    await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [ids]);
    fastify.io.emit('tickets:deleted', { ids });
    return reply.send({ message: `Deleted ${ids.length} tickets` });
  });

  // Delete all tickets (admin only)
  fastify.delete('/tickets', { preHandler: [fastify.requirePermission('delete_tickets')] }, async (request, reply) => {
    await pool.query('DELETE FROM tickets');
    fastify.io.emit('tickets:deleted', { all: true });
    return reply.status(204).send();
  });

  // Merge tickets into a primary ticket
  fastify.post('/tickets/:id/merge', { preHandler: [fastify.requirePermission('assign_tickets')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      mergeIds: z.array(z.string().uuid()).min(1),
    }).parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify primary ticket exists
      const primary = await client.query('SELECT * FROM tickets WHERE id = $1', [id]);
      if (primary.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Primary ticket not found' });
      }

      const primaryTicket = primary.rows[0];

      // Close all merged tickets and link them (batch)
      await client.query(
        `UPDATE tickets SET status = 'closed', closed_at = NOW(), merged_into_id = $1 WHERE id = ANY($2)`,
        [id, body.mergeIds]
      );
      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
         SELECT unnest($1::uuid[]), $2, 'merged', $3`,
        [body.mergeIds, request.user.id, `Merged into #${primaryTicket.number}`]
      );

      // Log activity on primary
      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
         VALUES ($1, $2, 'merge_received', $3)`,
        [id, request.user.id, `${body.mergeIds.length} ticket(s) merged into this ticket`]
      );

      await client.query('COMMIT');
      fastify.io.emit('tickets:merged', { primaryId: id, mergedIds: body.mergeIds });
      return reply.send({ message: 'Tickets merged successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Add comment
  fastify.post('/tickets/:id/comments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      body: z.string().min(1),
      is_internal: z.boolean().default(false),
      send_email: z.boolean().optional(),
    }).parse(request.body);

    // Restrict is_internal
    let is_internal = body.is_internal;
    if (request.user.role !== 'agent' && request.user.role !== 'admin') {
      is_internal = false;
    }

    // Verify ticket exists and user has access
    const accessCheck = await pool.query(
      `SELECT id, created_by_id FROM tickets WHERE id = $1`,
      [id]
    );
    if (accessCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }
    const ticketRow = accessCheck.rows[0];
    if (request.user.role !== 'admin' && request.user.role !== 'agent' && ticketRow.created_by_id !== request.user.id) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, request.user.id, body.body, is_internal]
      );

      const comment = {
        ...result.rows[0],
        author_name: request.user.name,
        author_email: request.user.email,
      };
      let preservedComment: any = null;

      // Get ticket info for notification
      const ticketResult = await client.query('SELECT number, title, description, created_by_id, assigned_to_id, status, priority, created_at, due_date, ticket_type, category_id FROM tickets WHERE id = $1', [id]);
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Ticket not found' });
      }
      const ticket = ticketResult.rows[0];

      // Notify creator and assignee of new comments (always, even self-comment)
      // In ITSM, the notification panel is an activity log — users see all activity on their tickets
      if (!is_internal) {
        const commentNotified = new Set<string>();
        await createNotification(
          client,
          ticket.created_by_id,
          'new_comment',
          `New reply on ticket #${ticket.number}: ${ticket.title}`,
          '',
          id
        );
        commentNotified.add(ticket.created_by_id);
        if (ticket.assigned_to_id && !commentNotified.has(ticket.assigned_to_id)) {
          await createNotification(
            client,
            ticket.assigned_to_id,
            'new_comment',
            `New reply on assigned ticket #${ticket.number}: ${ticket.title}`,
            '',
            id
          );
        }
      }

      // Log activity
      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action)
         VALUES ($1, $2, 'commented')`,
        [id, request.user.id]
      );

      // Auto-reopen closed/resolved tickets when the reporter (end user) comments
      const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';
      const isReporter = request.user.role === 'user' && ticket.created_by_id === request.user.id;
      if (isClosed && isReporter) {
        let autoReopenEnabled = false;
        try {
          const settingResult = await client.query(
            "SELECT value FROM system_settings WHERE key = 'email_parsing_config'"
          );
          if (settingResult.rows.length > 0) {
            const config = JSON.parse(settingResult.rows[0].value);
            autoReopenEnabled = config.auto_reopen_on_reply === true;
          }
        } catch { /* use default */ }

        if (autoReopenEnabled) {
          // Preserve close_notes as an internal note before clearing
          if (ticket.close_notes) {
            const result = await client.query(
              `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal)
               VALUES ($1, $2, $3, true)
               RETURNING *`,
              [id, request.user.id, ticket.close_notes]
            );
            preservedComment = {
              ...result.rows[0],
              author_name: request.user.name,
              author_email: request.user.email,
            };
          }
          await client.query(
            "UPDATE tickets SET status = 'open', close_notes = NULL, closed_at = NULL, resolved_at = NULL WHERE id = $1",
            [id]
          );
          await client.query(
            `INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value)
             VALUES ($1, $2, 'status_changed', $3, 'open')`,
            [id, request.user.id, ticket.status]
          );
          (ticket as any).status = 'open';
        }
      }

      await client.query('COMMIT');

      if (preservedComment) {
        fastify.io.emit(`ticket:comment:${id}`, { comment: preservedComment });
      }
      fastify.io.emit(`ticket:comment:${id}`, { comment });

      // Look up attachments for this comment to include in email
      let commentAttachments: EmailAttachment[] = [];
      try {
        const attResult = await pool.query(
          'SELECT original_name, mime_type, storage_path FROM ticket_attachments WHERE comment_id = $1',
          [comment.id]
        );
        for (const att of attResult.rows) {
          if (fs.existsSync(att.storage_path)) {
            commentAttachments.push({
              filename: att.original_name,
              content: fs.readFileSync(att.storage_path),
              mimeType: att.mime_type,
            });
          }
        }
      } catch {
        // Attachments are optional — skip if lookup fails
        commentAttachments = [];
      }

      // Fire-and-forget: dispatch comment notification through the pipeline
      if (!is_internal && body.send_email !== false) {
        dispatchNotifications({
          type: 'comment_added',
          ticket: { id: id, number: ticket.number, title: ticket.title, description: ticket.description, priority: (ticket as any).priority || 'medium', status: ticket.status, ticket_type: (ticket as any).ticket_type || 'incident', category_id: ticket.category_id, due_date: ticket.due_date, created_at: (ticket as any).created_at || new Date().toISOString(), created_by_id: ticket.created_by_id, assigned_to_id: ticket.assigned_to_id },
          actor: { id: request.user.id, name: request.user.name, email: request.user.email },
          comment: { id: comment.id, body: body.body, authorName: request.user.name },
        }).catch(() => {});
      }

      return reply.status(201).send({ data: comment });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // PATCH /tickets/:id/comments/:commentId — edit comment (admin/agent or own comment within 15min)
  fastify.patch('/tickets/:id/comments/:commentId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user
    const { id, commentId } = request.params as any
    const { content } = request.body as any

    if (!content?.trim()) return reply.status(400).send({ error: 'Content is required' })

    const { rows } = await pool.query('SELECT * FROM ticket_comments WHERE id=$1 AND ticket_id=$2', [commentId, id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Comment not found' })
    const comment = rows[0]

    const isAdminOrAgent = user.role === 'admin' || user.role === 'agent'
    const isOwner = comment.author_id === user.id
    const withinWindow = (Date.now() - new Date(comment.created_at).getTime()) < 15 * 60 * 1000

    if (!isAdminOrAgent && !(isOwner && withinWindow)) {
      return reply.status(403).send({ error: 'You cannot edit this comment' })
    }

    const { rows: updated } = await pool.query(
      `UPDATE ticket_comments SET body=$1, edited_at=NOW(), edited_by_id=$2, is_edited=true WHERE id=$3 RETURNING *`,
      [content.trim(), user.id, commentId]
    )
    return reply.send({ data: updated[0] })
  })
}
