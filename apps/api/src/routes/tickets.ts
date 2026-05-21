import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';

const createTicketSchema = z.object({
  title: z.string().min(3).max(500),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']).default('incident'),
  tags: z.array(z.string()).default([]),
  assigned_to_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
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
        c.name as category_name, c.color as category_color
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by_id = u1.id
       LEFT JOIN users u2 ON t.assigned_to_id = u2.id
       LEFT JOIN categories c ON t.category_id = c.id
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
        c.name as category_name, c.color as category_color
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by_id = u1.id
       LEFT JOIN users u2 ON t.assigned_to_id = u2.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    // Row-level auth check
    if (request.user.role === 'user') {
      if (ticket.created_by_id !== request.user.id && ticket.assigned_to_id !== request.user.id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
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
    
    commentsQuery += ` ORDER BY tc.created_at ASC`;

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

    return reply.send({
      data: {
        ...ticket,
        comments: comments.rows,
        activity: activity.rows,
      },
    });
  });

  // Create ticket
  fastify.post('/tickets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createTicketSchema.parse(request.body);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO tickets (title, description, priority, ticket_type, tags, created_by_id, assigned_to_id, category_id, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [body.title, body.description, body.priority, body.ticket_type, body.tags, request.user.id, body.assigned_to_id || null, body.category_id || null, body.due_date || null]
      );

      const ticket = result.rows[0];

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
      }

      await client.query('COMMIT');

      // Emit real-time event
      fastify.io.emit('ticket:created', { ticket });

      // Also notify the assigned user's personal room
      if (ticket.assigned_to_id) {
        fastify.io.to(`user:${ticket.assigned_to_id}`).emit('notification:new', { ticketId: ticket.id });
      }

      return reply.status(201).send({ data: ticket });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Bulk update tickets
  fastify.patch('/tickets/bulk', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      updates: z.object({
        status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigned_to_id: z.string().uuid().nullable().optional(),
        close_notes: z.string().optional(),
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
      if (body.close_notes !== undefined) { updates.push(`close_notes = $${paramIdx++}`); params.push(body.close_notes); }
      if (body.status === 'resolved') { updates.push(`resolved_at = NOW()`); }
      if (body.status === 'closed') { updates.push(`closed_at = NOW()`); }

      if (updates.length === 0) {
        await client.query('COMMIT');
        return reply.send({ data: ticket });
      }

      params.push(id);
      const result = await client.query(
        `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params
      );

      const updated = result.rows[0];

      // Log activity for status changes
      if (body.status && body.status !== ticket.status) {
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value)
           VALUES ($1, $2, 'status_changed', $3, $4)`,
          [id, request.user.id, ticket.status, body.status]
        );

        // Notify creator when resolved
        if (body.status === 'resolved') {
          await createNotification(
            client,
            updated.created_by_id,
            'ticket_resolved',
            `Your ticket #${updated.number} has been resolved`,
            '',
            updated.id
          );
        }
      }

      await client.query('COMMIT');

      // Emit real-time event
      fastify.io.emit(`ticket:updated:${id}`, { ticket: updated });
      fastify.io.emit('ticket:updated', { ticket: updated });

      return reply.send({ data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Delete ticket (admin only)
  fastify.delete('/tickets/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
    fastify.io.emit('ticket:deleted', { id });
    return reply.status(204).send();
  });

  // Merge tickets into a primary ticket
  fastify.post('/tickets/:id/merge', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
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

      // Close all merged tickets and link them
      for (const mergeId of body.mergeIds) {
        await client.query(
          `UPDATE tickets SET status = 'closed', closed_at = NOW(), merged_into_id = $1 WHERE id = $2`,
          [id, mergeId]
        );
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
           VALUES ($1, $2, 'merged', $3)`,
          [mergeId, request.user.id, `Merged into #${primaryTicket.number}`]
        );
      }

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

      const comment = result.rows[0];

      // Get ticket info for notification
      const ticketResult = await client.query('SELECT number, title, created_by_id FROM tickets WHERE id = $1', [id]);
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Ticket not found' });
      }
      const ticket = ticketResult.rows[0];

      // Notify creator if someone else comments
      if (ticket.created_by_id !== request.user.id && !is_internal) {
        await createNotification(
          client,
          ticket.created_by_id,
          'new_comment',
          `New reply on ticket #${ticket.number}: ${ticket.title}`,
          '',
          id
        );
      }

      // Log activity
      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action)
         VALUES ($1, $2, 'commented')`,
        [id, request.user.id]
      );

      await client.query('COMMIT');

      fastify.io.emit(`ticket:comment:${id}`, { comment });

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
