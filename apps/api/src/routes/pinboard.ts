import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createPinSchema = z.object({
  metric_key: z.string().min(1).max(100),
  metric_label: z.string().min(1).max(200),
  metric_type: z.enum(['kpi', 'chart', 'table']),
  config: z.any().optional(),
  position: z.number().int().optional().default(0),
});

const updatePinSchema = z.object({
  metric_key: z.string().min(1).max(100).optional(),
  metric_label: z.string().min(1).max(200).optional(),
  metric_type: z.enum(['kpi', 'chart', 'table']).optional(),
  config: z.any().optional(),
  position: z.number().int().optional(),
});

// ─── Route Registration ─────────────────────────────────────────────────────

export default async function pinboardRoutes(fastify: FastifyInstance) {

  // GET /dashboard/pins — Get user's pinned metrics
  fastify.get('/dashboard/pins', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user;

    const result = await pool.query(
      `SELECT id, metric_key, metric_label, metric_type, config, position, created_at
       FROM user_dashboard_pins
       WHERE user_id = $1
       ORDER BY position ASC, created_at ASC`,
      [user.id]
    );

    return reply.send({ data: result.rows });
  });

  // POST /dashboard/pins — Pin a metric
  fastify.post('/dashboard/pins', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user;
    const body = createPinSchema.parse(request.body);

    // Get max position for user if not specified
    if (body.position === 0) {
      const posResult = await pool.query(
        `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM user_dashboard_pins WHERE user_id = $1`,
        [user.id]
      );
      body.position = posResult.rows[0].next_pos;
    }

    const result = await pool.query(
      `INSERT INTO user_dashboard_pins (user_id, metric_key, metric_label, metric_type, config, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, metric_key)
       DO UPDATE SET metric_label = EXCLUDED.metric_label,
                     metric_type = EXCLUDED.metric_type,
                     config = EXCLUDED.config,
                     position = EXCLUDED.position
       RETURNING id, metric_key, metric_label, metric_type, config, position, created_at`,
      [
        user.id,
        body.metric_key,
        body.metric_label,
        body.metric_type,
        body.config ? JSON.stringify(body.config) : null,
        body.position,
      ]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /dashboard/pins/:id — Update pin position or config
  fastify.patch('/dashboard/pins/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;
    const body = updatePinSchema.parse(request.body);

    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM user_dashboard_pins WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Pin not found' });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 2;

    if (body.metric_key !== undefined) { fields.push(`metric_key = $${paramIdx++}`); values.push(body.metric_key); }
    if (body.metric_label !== undefined) { fields.push(`metric_label = $${paramIdx++}`); values.push(body.metric_label); }
    if (body.metric_type !== undefined) { fields.push(`metric_type = $${paramIdx++}`); values.push(body.metric_type); }
    if (body.config !== undefined) { fields.push(`config = $${paramIdx++}`); values.push(JSON.stringify(body.config)); }
    if (body.position !== undefined) { fields.push(`position = $${paramIdx++}`); values.push(body.position); }

    if (fields.length === 0) {
      return reply.send({ data: existing.rows[0] });
    }

    const result = await pool.query(
      `UPDATE user_dashboard_pins SET ${fields.join(', ')} WHERE id = $1 RETURNING id, metric_key, metric_label, metric_type, config, position, created_at`,
      [id, ...values]
    );

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /dashboard/pins/:id — Unpin a metric
  fastify.delete('/dashboard/pins/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const existing = await pool.query(
      'SELECT id FROM user_dashboard_pins WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Pin not found' });
    }

    await pool.query('DELETE FROM user_dashboard_pins WHERE id = $1', [id]);

    return reply.send({ success: true });
  });
}
