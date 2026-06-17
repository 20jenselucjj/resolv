import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { eventBus } from '../services/event-bus';
import { dispatchNotifications } from '../services/notification-runner';
import type { EmailAttachment } from '../services/outbound-email';
import fs from 'fs';

async function createNotification(db: any, userId: string, type: string, title: string, body: string, ticketId?: string) {
  await db.query(
    'INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, $2, $3, $4, $5)',
    [userId, type, title, body, ticketId || null]
  );
}

export default async function ticketCommentRoutes(fastify: FastifyInstance) {

  // Add comment
  fastify.post('/tickets/:id/comments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      body: z.string().min(1),
      is_internal: z.boolean().default(false),
      send_email: z.boolean().optional(),
      parent_id: z.string().uuid().optional(),
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

    // If parent_id is specified, verify it exists and belongs to this ticket
    if (body.parent_id) {
      const parentCheck = await pool.query(
        `SELECT id FROM ticket_comments WHERE id = $1 AND ticket_id = $2`,
        [body.parent_id, id]
      );
      if (parentCheck.rows.length === 0) {
        return reply.status(400).send({ error: 'Parent comment not found or does not belong to this ticket' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, parent_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, request.user.id, body.body, is_internal, body.parent_id || null]
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

      // Track first agent/admin response for SLA first_response_at
      // Only set if the comment author is an agent/admin and first_response_at is still NULL
      if (request.user.role === 'agent' || request.user.role === 'admin') {
        try {
          await client.query(
            `UPDATE tickets SET first_response_at = NOW()
             WHERE id = $1 AND first_response_at IS NULL`,
            [id]
          );
        } catch (frErr: any) {
          fastify.log.error({ err: frErr, ticketId: id }, 'Failed to set first_response_at');
        }
      }

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

      // Publish event bus event
      eventBus.publish('comment.added', {
        entityType: 'ticket',
        entityId: id,
        actorId: request.user.id,
        data: { comment, ticket },
      });

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
