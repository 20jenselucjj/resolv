import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const updateCategorySchema = categorySchema.partial();

export default async function categoryRoutes(fastify: FastifyInstance) {
  // GET /categories - list all active categories (authenticated)
  fastify.get('/categories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(
      'SELECT * FROM categories WHERE is_active = true ORDER BY name ASC'
    );
    return reply.send({ data: result.rows });
  });

  // POST /categories - create category (admin only)
  fastify.post('/categories', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = categorySchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO categories (name, description, color, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [body.name, body.description || null, body.color || null, body.icon || null]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /categories/:id - update category (admin only)
  fastify.patch('/categories/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCategorySchema.parse(request.body);

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    const result = await pool.query(
      `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Category not found' });
    }

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /categories/:id - soft delete (admin only)
  fastify.delete('/categories/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'UPDATE categories SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Category not found' });
    }

    return reply.send({ message: 'Category deactivated successfully' });
  });
}
