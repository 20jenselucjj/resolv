import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../db/pool';

const listKnowledgeSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category_id: z.string().uuid().optional(),
  category: z.string().optional().transform(v => v || undefined),
  search: z.string().optional().transform(v => v || undefined),
  tags: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(20),
});

const createKnowledgeSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const updateKnowledgeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const helpfulSchema = z.object({
  helpful: z.boolean(),
});

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  // GET /knowledge - list articles
  fastify.get('/knowledge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = listKnowledgeSchema.parse(request.query);
    const isAdmin = request.user.role === 'admin';
    const page = query.page;
    const pageSize = query.pageSize;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Status filtering logic
    if (query.status) {
      // Non-admins are restricted to 'published' even if they ask for something else
      const statusToFilter = (!isAdmin && query.status !== 'published') ? 'published' : query.status;
      whereClause += ` AND ka.status = $${paramIdx++}`;
      params.push(statusToFilter);
    } else if (!isAdmin) {
      // Default to published for non-admins
      whereClause += ` AND ka.status = 'published'`;
    }
    // If admin and no status, show all (no filter)

    if (query.category_id) {
      whereClause += ` AND ka.category_id = $${paramIdx++}`;
      params.push(query.category_id);
    }

    if (query.category) {
      whereClause += ` AND c.name ILIKE $${paramIdx++}`;
      params.push(query.category);
    }

    if (query.search) {
      whereClause += ` AND ka.title ILIKE $${paramIdx++}`;
      params.push(`%${query.search}%`);
    }

    if (query.tags) {
      const tagList = query.tags.split(',').map(t => t.trim());
      whereClause += ` AND ka.tags && $${paramIdx++}`;
      params.push(tagList);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM knowledge_articles ka LEFT JOIN categories c ON ka.category_id = c.id ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT 
        ka.id, ka.title, ka.slug, ka.status, ka.category_id, 
        c.name as category_name, c.color as category_color, 
        ka.author_id, u.name as author_name, 
        ka.views, ka.helpful_count, ka.not_helpful_count, 
        ka.tags, ka.created_at, ka.updated_at, ka.published_at
       FROM knowledge_articles ka
       LEFT JOIN categories c ON ka.category_id = c.id
       LEFT JOIN users u ON ka.author_id = u.id
       ${whereClause}
       ORDER BY ka.published_at DESC NULLS LAST, ka.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      pageSize,
    });
  });

  // GET /knowledge/:slug - get single article
  fastify.get('/knowledge/:slug', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const result = await pool.query(
      `SELECT 
        ka.*, 
        c.name as category_name, c.color as category_color,
        u.name as author_name, u.avatar_url as author_avatar
       FROM knowledge_articles ka
       LEFT JOIN categories c ON ka.category_id = c.id
       LEFT JOIN users u ON ka.author_id = u.id
       WHERE ka.slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    const article = result.rows[0];

    // Non-agents/admins can only see published articles
    if (article.status !== 'published' && request.user.role !== 'admin' && request.user.role !== 'agent') {
      return reply.status(404).send({ error: 'Article not found' });
    }

    // Increment views only after access is confirmed
    await pool.query(
      'UPDATE knowledge_articles SET views = views + 1 WHERE slug = $1',
      [slug]
    );

    return reply.send({ data: article });
  });

  // POST /knowledge - create article (agent or admin only)
  fastify.post('/knowledge', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const body = createKnowledgeSchema.parse(request.body);
    const slug = generateSlug(body.title);
    const publishedAt = body.status === 'published' ? new Date() : null;

    const result = await pool.query(
      `INSERT INTO knowledge_articles (title, slug, body, category_id, tags, status, author_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.title, 
        slug, 
        body.body, 
        body.category_id || null, 
        body.tags || [], 
        body.status || 'draft', 
        request.user.id,
        publishedAt
      ]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /knowledge/:id - update article (admin or original author)
  fastify.patch('/knowledge/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateKnowledgeSchema.parse(request.body);

    const current = await pool.query('SELECT * FROM knowledge_articles WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    const article = current.rows[0];

    // Check permissions: admin or original author
    if (request.user.role !== 'admin' && request.user.id !== article.author_id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (body.title !== undefined) { 
      updates.push(`title = $${paramIdx++}`); 
      params.push(body.title); 
    }
    if (body.body !== undefined) { updates.push(`body = $${paramIdx++}`); params.push(body.body); }
    if (body.category_id !== undefined) { updates.push(`category_id = $${paramIdx++}`); params.push(body.category_id); }
    if (body.tags !== undefined) { updates.push(`tags = $${paramIdx++}`); params.push(body.tags); }
    if (body.status !== undefined) { 
      updates.push(`status = $${paramIdx++}`); 
      params.push(body.status); 
      
      // If status changes to 'published' and published_at is null, set published_at=NOW()
      if (body.status === 'published' && !article.published_at) {
        updates.push(`published_at = NOW()`);
      }
    }

    if (updates.length === 0) {
      return reply.send({ data: article });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE knowledge_articles SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );

    const updated = result.rows[0];

    // Log to audit_log
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        request.user.id, 
        'update_knowledge_article', 
        'knowledge_article', 
        id, 
        JSON.stringify(article), 
        JSON.stringify(updated), 
        request.ip
      ]
    );

    return reply.send({ data: updated });
  });

  // DELETE /knowledge/:id - admin only
  fastify.delete('/knowledge/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      "UPDATE knowledge_articles SET status = 'archived' WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    return reply.status(204).send();
  });

  // POST /knowledge/:id/helpful - authenticated
  fastify.post('/knowledge/:id/helpful', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { helpful } = helpfulSchema.parse(request.body);

    const column = helpful ? 'helpful_count' : 'not_helpful_count';
    const result = await pool.query(
      `UPDATE knowledge_articles SET ${column} = ${column} + 1 WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    return reply.send({ success: true });
  });
}
