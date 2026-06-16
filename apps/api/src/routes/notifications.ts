import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function notificationRoutes(fastify: FastifyInstance) {
  // GET /notifications - authenticated
  fastify.get('/notifications', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { unread_only, limit: queryLimit = '20', offset: queryOffset = '0' } = request.query as { unread_only?: string; limit?: string; offset?: string };
    const limit = Math.min(Math.abs(parseInt(queryLimit as string, 10) || 20), 100);
    const offset = Math.max(parseInt(queryOffset as string, 10) || 0, 0);
    
    let query = 'SELECT id, user_id, type, title, body, ticket_id, is_read, created_at FROM notifications WHERE user_id = $1';
    const params: any[] = [request.user.id];
    
    if (unread_only === 'true') {
      query += ' AND is_read = false';
    }
    
    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return reply.send({ data: result.rows });
  });

  // POST /notifications/:id/read - mark single notification as read
  fastify.post('/notifications/:id/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, request.user.id]
    );
    
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Notification not found' });
    }
    
    return reply.send({ success: true });
  });

  // POST /notifications/read-all - mark all current user's notifications as read
  fastify.post('/notifications/read-all', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [request.user.id]
    );
    return reply.send({ success: true });
  });

  // DELETE /notifications - delete all notifications for current user
  fastify.delete('/notifications', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [request.user.id]
    );
    return reply.status(204).send();
  });

  // DELETE /notifications/:id - delete notification (own only)
  fastify.delete('/notifications/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, request.user.id]
    );
    
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Notification not found' });
    }
    
    return reply.status(204).send();
  });
}
