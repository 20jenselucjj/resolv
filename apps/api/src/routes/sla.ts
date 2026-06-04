import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { getCached, setCache, clearCache } from '../lib/cache';

const slaPolicySchema = z.object({
  name: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  response_time_hours: z.number().nonnegative(),
  resolution_time_hours: z.number().nonnegative(),
});

const updateSlaPolicySchema = slaPolicySchema.partial();

export default async function slaRoutes(fastify: FastifyInstance) {
  // GET /sla-policies - list all SLA policies (authenticated)
  fastify.get('/sla-policies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const cached = getCached<any[]>('sla-policies:all');
    if (cached) return reply.send({ data: cached });

    const result = await pool.query(
      'SELECT * FROM sla_policies WHERE is_active = true ORDER BY priority DESC'
    );
    setCache('sla-policies:all', result.rows);
    return reply.send({ data: result.rows });
  });

  // POST /sla-policies - create (admin only)
  fastify.post('/sla-policies', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = slaPolicySchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO sla_policies (name, priority, response_time_hours, resolution_time_hours)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [body.name, body.priority, body.response_time_hours, body.resolution_time_hours]
    );
    clearCache('sla-policies');
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /sla-policies/:id - update (admin only)
  fastify.patch('/sla-policies/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSlaPolicySchema.parse(request.body);

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    const result = await pool.query(
      `UPDATE sla_policies SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'SLA policy not found' });
    }

    clearCache('sla-policies');
    return reply.send({ data: result.rows[0] });
  });

  // DELETE /sla-policies/:id - soft delete (admin only)
  fastify.delete('/sla-policies/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'UPDATE sla_policies SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'SLA policy not found' });
    }

    clearCache('sla-policies');
    return reply.send({ message: 'SLA policy deactivated successfully' });
  });
}
