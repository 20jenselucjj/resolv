import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { getCached, setCache, clearCache } from '../lib/cache';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().optional().default('#6366f1'),
  icon: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional().default(0),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export default async function categoryRoutes(fastify: FastifyInstance) {
  // GET /categories - list all active categories (authenticated)
  // Supports ?tree=true to return nested tree structure
  fastify.get('/categories', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['categories'],
      summary: 'List all active categories',
      querystring: {
        type: 'object',
        properties: {
          tree: { type: 'string', enum: ['true'], description: 'Return tree structure' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  color: { type: 'string' },
                  icon: { type: 'string' },
                  is_active: { type: 'boolean' },
                  parent_id: { type: 'string' },
                  sort_order: { type: 'integer' },
                  children_count: { type: 'integer' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as { tree?: string };
    const cached = getCached<any[]>('categories:all');
    if (cached && !query.tree) return reply.send({ data: cached });

    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM categories WHERE parent_id = c.id AND is_active = true)::int AS children_count
       FROM categories c
       WHERE c.is_active = true
       ORDER BY c.sort_order ASC, c.name ASC`
    );

    if (query.tree) {
      // Build tree in TypeScript from flat list
      const flat = result.rows;
      const map = new Map<string, any>();
      const roots: any[] = [];

      // First pass: create all nodes
      flat.forEach((cat: any) => {
        map.set(cat.id, { ...cat, children: [] });
      });

      // Second pass: wire up children
      flat.forEach((cat: any) => {
        const node = map.get(cat.id);
        if (cat.parent_id && map.has(cat.parent_id)) {
          map.get(cat.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      setCache('categories:all', flat);
      return reply.send({ data: roots });
    }

    setCache('categories:all', result.rows);
    return reply.send({ data: result.rows });
  });

  // POST /categories - create category (admin only)
  fastify.post('/categories', {
    preHandler: [fastify.requirePermission('manage_categories')],
    schema: {
      tags: ['categories'],
      summary: 'Create a new category',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Category name' },
          description: { type: 'string', description: 'Optional description' },
          color: { type: 'string', description: 'Hex color code' },
          icon: { type: 'string', description: 'Icon identifier' },
          parent_id: { type: 'string', description: 'Parent category UUID' },
          sort_order: { type: 'integer', description: 'Display sort order' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                color: { type: 'string' },
                icon: { type: 'string' },
                is_active: { type: 'boolean' },
                parent_id: { type: 'string' },
                sort_order: { type: 'integer' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO categories (name, description, color, icon, parent_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [body.name, body.description || null, body.color || null, body.icon || null, body.parent_id || null, body.sort_order ?? 0]
    );
    clearCache('categories');
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /categories/:id - update category (admin only)
  fastify.patch('/categories/:id', { preHandler: [fastify.requirePermission('manage_categories')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCategorySchema.parse(request.body);

    // Validate at least one field to update
    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    // Prevent circular references when updating parent_id
    if (body.parent_id !== undefined && body.parent_id !== null) {
      if (body.parent_id === id) {
        return reply.status(400).send({ error: 'Cannot set parent to self' });
      }

      // Check that the new parent is not a descendant of this category
      // Traverse up from the proposed parent to ensure it doesn't lead back to this category
      let checkId: string | null = body.parent_id;
      while (checkId) {
        if (checkId === id) {
          return reply.status(400).send({ error: 'Circular reference detected: parent would create a cycle' });
        }
        const parentResult: { rows: Array<{ parent_id: string | null }> } = await pool.query(
          'SELECT parent_id FROM categories WHERE id = $1',
          [checkId]
        );
        checkId = parentResult.rows[0]?.parent_id || null;
      }
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    // Convert empty string parent_id to null
    if (body.parent_id !== undefined) {
      const parentIdx = fields.indexOf('parent_id');
      if (parentIdx !== -1 && values[parentIdx] === '') {
        values[parentIdx] = null;
      }
    }

    const result = await pool.query(
      `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Category not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_category', 'categories', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    clearCache('categories');
    return reply.send({ data: result.rows[0] });
  });

  // GET /categories/:id/children - get direct children of a category
  fastify.get('/categories/:id/children', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['categories'],
      summary: 'Get direct children of a category',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  color: { type: 'string' },
                  icon: { type: 'string' },
                  is_active: { type: 'boolean' },
                  parent_id: { type: 'string' },
                  sort_order: { type: 'integer' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT * FROM categories WHERE parent_id = $1 AND is_active = true ORDER BY sort_order ASC, name ASC`,
      [id]
    );
    return reply.send({ data: result.rows });
  });

  // GET /categories/:id/ancestors - get all ancestors (path to root) for breadcrumb display
  fastify.get('/categories/:id/ancestors', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['categories'],
      summary: 'Get all ancestors of a category (breadcrumb path to root)',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  parent_id: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ancestors: any[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const ancestorResult: { rows: Array<{ id: string; name: string; parent_id: string | null }> } = await pool.query(
        'SELECT id, name, parent_id FROM categories WHERE id = $1',
        [currentId]
      );
      if (ancestorResult.rows.length === 0) break;
      const ancestorRow = ancestorResult.rows[0];
      ancestors.unshift({ id: ancestorRow.id, name: ancestorRow.name, parent_id: ancestorRow.parent_id });
      currentId = ancestorRow.parent_id;
    }

    return reply.send({ data: ancestors });
  });

  // DELETE /categories/:id - soft delete (admin only)
  fastify.delete('/categories/:id', { preHandler: [fastify.requirePermission('manage_categories')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'UPDATE categories SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Category not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_category', 'categories', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    clearCache('categories');
    return reply.send({ message: 'Category deactivated successfully' });
  });
}
