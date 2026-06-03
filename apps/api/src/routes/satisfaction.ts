import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function satisfactionRoutes(fastify: FastifyInstance) {
  // GET /satisfaction/:ticketId — get survey status for a ticket
  fastify.get('/satisfaction/:ticketId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const user = request.user as any;

    const result = await pool.query(
      'SELECT * FROM satisfaction_surveys WHERE ticket_id = $1 AND user_id = $2',
      [ticketId, user.id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'No survey found for this ticket' });
    }

    return reply.send({ data: result.rows[0] });
  });

  // POST /satisfaction/:ticketId/rate — submit a rating
  // This can be called either authenticated OR via a token in the URL (for email links)
  fastify.post('/satisfaction/:ticketId/rate', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const body = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
      user_id: z.string().uuid().optional(),  // For unauthenticated email link submissions
    }).parse(request.body);

    // Determine user — either from auth or from body
    let userId = body.user_id;
    if (!userId) {
      // Try to get from auth
      try {
        const authUser = request.user as any;
        if (authUser?.id) userId = authUser.id;
      } catch {}
    }

    if (!userId) {
      return reply.status(400).send({ error: 'user_id is required' });
    }

    // Verify survey exists
    const survey = await pool.query(
      'SELECT * FROM satisfaction_surveys WHERE ticket_id = $1 AND user_id = $2',
      [ticketId, userId]
    );

    if (survey.rows.length === 0) {
      return reply.status(404).send({ error: 'No survey found for this ticket' });
    }

    if (survey.rows[0].responded_at) {
      return reply.status(409).send({ error: 'Survey already completed' });
    }

    // Update survey with rating
    const result = await pool.query(
      `UPDATE satisfaction_surveys
       SET rating = $1, comment = $2, responded_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [body.rating, body.comment || null, survey.rows[0].id]
    );

    return reply.send({ data: result.rows[0] });
  });

  // GET /satisfaction/:ticketId/rate — handle GET requests from email links
  // This redirects to the web app with the rating pre-filled
  fastify.get('/satisfaction/:ticketId/rate', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const rating = (request.query as any)?.rating;

    if (!rating || rating < 1 || rating > 5) {
      return reply.status(400).send({ error: 'Invalid rating parameter' });
    }

    // Redirect to the web app's survey page
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return reply.redirect(`${webUrl}/satisfaction/${ticketId}?rating=${rating}`);
  });

  // GET /admin/satisfaction-stats — get aggregate satisfaction stats (admin only)
  fastify.get('/admin/satisfaction-stats', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_surveys,
        COUNT(CASE WHEN responded_at IS NOT NULL THEN 1 END) as total_responses,
        ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END)::numeric, 2) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1
      FROM satisfaction_surveys
    `);

    // Get recent responses
    const recent = await pool.query(`
      SELECT s.*, t.number as ticket_number, t.title as ticket_title, u.name as user_name
      FROM satisfaction_surveys s
      JOIN tickets t ON s.ticket_id = t.id
      JOIN users u ON s.user_id = u.id
      WHERE s.responded_at IS NOT NULL
      ORDER BY s.responded_at DESC
      LIMIT 20
    `);

    return reply.send({
      data: {
        summary: result.rows[0],
        recent: recent.rows
      }
    });
  });
}
