import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function templateRoutes(fastify: FastifyInstance) {
  // GET /templates - list templates (public templates + user's own)
  fastify.get('/templates', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(
      `SELECT tt.*, u.name as created_by_name, c.name as category_name
       FROM ticket_templates tt
       LEFT JOIN users u ON tt.created_by = u.id
       LEFT JOIN categories c ON tt.category_id = c.id
       WHERE tt.is_public = true OR tt.created_by = $1
       ORDER BY tt.created_at DESC`,
      [request.user.id]
    );
    return reply.send({ data: result.rows });
  });

  // GET /templates/:id - get single template
  fastify.get('/templates/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT tt.*, u.name as created_by_name, c.name as category_name
       FROM ticket_templates tt
       LEFT JOIN users u ON tt.created_by = u.id
       LEFT JOIN categories c ON tt.category_id = c.id
       WHERE tt.id = $1 AND (tt.is_public = true OR tt.created_by = $2)`,
      [id, request.user.id]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    return reply.send({ data: result.rows[0] });
  });

  // POST /templates - create template (admin/agent only)
  fastify.post('/templates', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(200),
      title: z.string().max(500).default(''),
      description: z.string().default(''),
      ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']).default('incident'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      category_id: z.string().uuid().optional().nullable(),
      is_public: z.boolean().default(false),
    }).parse(request.body);

    const result = await pool.query(
      `INSERT INTO ticket_templates (name, title, description, ticket_type, priority, category_id, created_by, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [body.name, body.title, body.description, body.ticket_type, body.priority, body.category_id || null, request.user.id, body.is_public]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /templates/:id - update template (owner or admin only)
  fastify.patch('/templates/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Check ownership or admin
    const existing = await pool.query('SELECT * FROM ticket_templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    const template = existing.rows[0];
    if (template.created_by !== request.user.id && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = z.object({
      name: z.string().min(1).max(200).optional(),
      title: z.string().max(500).optional(),
      description: z.string().optional(),
      ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category_id: z.string().uuid().nullable().optional(),
      is_public: z.boolean().optional(),
    }).parse(request.body);

    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return reply.send({ data: template });
    
    const setClauses = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);
    
    const result = await pool.query(
      `UPDATE ticket_templates SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /templates/:id - delete template (owner or admin only)
  fastify.delete('/templates/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = await pool.query('SELECT * FROM ticket_templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    const template = existing.rows[0];
    if (template.created_by !== request.user.id && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await pool.query('DELETE FROM ticket_templates WHERE id = $1', [id]);
    return reply.send({ success: true });
  });
}
