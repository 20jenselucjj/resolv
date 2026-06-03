import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function watcherRoutes(fastify: FastifyInstance) {
  // GET /tickets/:id/watchers — list watchers for a ticket
  fastify.get('/tickets/:id/watchers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ticket exists
    const ticket = await pool.query('SELECT id FROM tickets WHERE id = $1', [id]);
    if (ticket.rows.length === 0) return reply.status(404).send({ error: 'Ticket not found' });

    const result = await pool.query(
      `SELECT tw.id, tw.ticket_id, tw.user_id, tw.email, tw.created_at,
              COALESCE(u.name, tw.email) as name,
              COALESCE(u.email, tw.email) as email_address
       FROM ticket_watchers tw
       LEFT JOIN users u ON tw.user_id = u.id
       WHERE tw.ticket_id = $1
       ORDER BY tw.created_at ASC`,
      [id]
    );

    return reply.send({ data: result.rows });
  });

  // POST /tickets/:id/watchers — add a watcher (by user_id or email)
  fastify.post('/tickets/:id/watchers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      user_id: z.string().uuid().optional(),
      email: z.string().email().optional(),
    }).refine(data => data.user_id || data.email, { message: 'user_id or email is required' }).parse(request.body);

    const user = request.user as any;

    // Verify ticket exists
    const ticket = await pool.query('SELECT id FROM tickets WHERE id = $1', [id]);
    if (ticket.rows.length === 0) return reply.status(404).send({ error: 'Ticket not found' });

    // Only agents/admins can add watchers (or the ticket creator)
    const ticketCheck = await pool.query('SELECT created_by_id FROM tickets WHERE id = $1', [id]);
    if (user.role === 'user' && ticketCheck.rows[0]?.created_by_id !== user.id) {
      return reply.status(403).send({ error: 'Only the ticket creator or agents can add watchers' });
    }

    // If user_id provided, look up their email
    let email = body.email;
    let userId = body.user_id || null;
    if (userId) {
      const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        email = userResult.rows[0].email;
      } else {
        return reply.status(404).send({ error: 'User not found' });
      }
    }

    try {
      // Check if already a watcher
      if (userId) {
        const existing = await pool.query(
          'SELECT id FROM ticket_watchers WHERE ticket_id = $1 AND user_id = $2',
          [id, userId]
        );
        if (existing.rows.length > 0) return reply.status(409).send({ error: 'Watcher already exists' });
      } else if (email) {
        const existing = await pool.query(
          'SELECT id FROM ticket_watchers WHERE ticket_id = $1 AND email = $2',
          [id, email]
        );
        if (existing.rows.length > 0) return reply.status(409).send({ error: 'Watcher already exists' });
      }

      const result = await pool.query(
        `INSERT INTO ticket_watchers (ticket_id, user_id, email, added_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, userId, email, user.id]
      );
      return reply.status(201).send({ data: result.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Watcher already exists' });
      }
      throw err;
    }
  });

  // DELETE /tickets/:id/watchers/:watcherId — remove a watcher
  fastify.delete('/tickets/:id/watchers/:watcherId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id, watcherId } = request.params as { id: string; watcherId: string };
    const user = request.user as any;

    // Verify watcher exists
    const watcher = await pool.query(
      'SELECT * FROM ticket_watchers WHERE id = $1 AND ticket_id = $2',
      [watcherId, id]
    );
    if (watcher.rows.length === 0) return reply.status(404).send({ error: 'Watcher not found' });

    // Only agents/admins or the watcher themselves can remove
    if (user.role === 'user' && watcher.rows[0].user_id !== user.id) {
      return reply.status(403).send({ error: 'Cannot remove another user as a watcher' });
    }

    await pool.query('DELETE FROM ticket_watchers WHERE id = $1', [watcherId]);
    return reply.status(204).send();
  });
}
