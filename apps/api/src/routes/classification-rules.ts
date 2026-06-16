import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';

const ruleSchema = z.object({
  name: z.string().min(1).max(255),
  match_type: z.enum(['any', 'all']).default('any'),
  keywords: z.array(z.string().min(1)).min(1),
  ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']),
  priority: z.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

const ruleUpdateSchema = ruleSchema.partial();

export default async function classificationRulesRoutes(fastify: FastifyInstance) {
  // GET /admin/classification-rules - list all rules
  fastify.get('/admin/classification-rules', { preHandler: [fastify.requirePermission('manage_classification')] }, async (request, reply) => {
    const { limit: queryLimit, offset: queryOffset } = request.query as any;
    const limit = Math.min(Math.abs(parseInt(queryLimit as string, 10) || 50), 100);
    const offset = Math.max(parseInt(queryOffset as string, 10) || 0, 0);

    const { rows } = await pool.query(
      'SELECT * FROM ticket_classification_rules ORDER BY priority DESC, name ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return reply.send({ data: rows });
  });

  // POST /admin/classification-rules - create a new rule
  fastify.post('/admin/classification-rules', { preHandler: [fastify.requirePermission('manage_classification')] }, async (request, reply) => {
    const body = ruleSchema.parse(request.body);

    const { rows } = await pool.query(
      `INSERT INTO ticket_classification_rules (name, match_type, keywords, ticket_type, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [body.name, body.match_type, body.keywords, body.ticket_type, body.priority, body.is_active]
    );

    return reply.status(201).send({ data: rows[0] });
  });

  // PATCH /admin/classification-rules/:id - update a rule
  fastify.patch('/admin/classification-rules/:id', { preHandler: [fastify.requirePermission('manage_classification')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ruleUpdateSchema.parse(request.body);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (body.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(body.name); }
    if (body.match_type !== undefined) { fields.push(`match_type = $${paramIdx++}`); values.push(body.match_type); }
    if (body.keywords !== undefined) { fields.push(`keywords = $${paramIdx++}`); values.push(body.keywords); }
    if (body.ticket_type !== undefined) { fields.push(`ticket_type = $${paramIdx++}`); values.push(body.ticket_type); }
    if (body.priority !== undefined) { fields.push(`priority = $${paramIdx++}`); values.push(body.priority); }
    if (body.is_active !== undefined) { fields.push(`is_active = $${paramIdx++}`); values.push(body.is_active); }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE ticket_classification_rules SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Classification rule not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_classification_rule', 'ticket_classification_rules', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: rows[0] });
  });

  // DELETE /admin/classification-rules/:id - delete a rule
  fastify.delete('/admin/classification-rules/:id', { preHandler: [fastify.requirePermission('manage_classification')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      'DELETE FROM ticket_classification_rules WHERE id = $1 RETURNING id',
      [id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Classification rule not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_classification_rule', 'ticket_classification_rules', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ message: 'Rule deleted successfully' });
  });
}
