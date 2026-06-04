import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { pool } from '../db/pool';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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

  // POST /knowledge/images - upload inline content image for articles (supports drag-and-drop)
  fastify.post('/knowledge/images', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const data = await (request as any).file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Only image files are allowed' });
    }

    const ext = path.extname(data.filename) || '.png';
    const filename = `kb-img-${crypto.randomUUID()}${ext}`;
    const dir = path.join(UPLOAD_DIR, 'kb-images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const storagePath = path.join(dir, filename);

    await pipeline(data.file, fs.createWriteStream(storagePath));
    const stat = fs.statSync(storagePath);

    const url = `/api/knowledge/images/${filename}`;
    return reply.send({ data: { url, filename, size: stat.size, mime_type: data.mimetype } });
  });

  // GET /knowledge/images/:filename - serve inline content images (no auth; images are secured by random UUID filenames)
  fastify.get('/knowledge/images/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(UPLOAD_DIR, 'kb-images', filename);
    if (!fs.existsSync(filePath)) return reply.status(404).send({ error: 'Image not found' });

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml'
    };
    reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(fs.createReadStream(filePath));
  });

  // POST /knowledge/:id/attachments - upload file to knowledge article
  fastify.post('/knowledge/:id/attachments', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const { rows: articles } = await pool.query('SELECT id FROM knowledge_articles WHERE id = $1', [id]);
      if (articles.length === 0) return reply.status(404).send({ error: 'Article not found' });

      const data = await (request as any).file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });

      const ext = path.extname(data.filename);
      const filename = `${crypto.randomUUID()}${ext}`;
      const storagePath = path.join(UPLOAD_DIR, filename);

      const ws = fs.createWriteStream(storagePath);
      await pipeline(data.file, ws);
      const stat = fs.statSync(storagePath);

      const { rows } = await pool.query(
        `INSERT INTO knowledge_article_attachments (article_id, uploaded_by, filename, original_name, mime_type, size_bytes, storage_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, request.user.id, filename, data.filename, data.mimetype, stat.size, storagePath]
      );

      return reply.send({ data: rows[0] });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Upload failed', message: err.message });
    }
  });

  // GET /knowledge/:id/attachments - list article attachments
  fastify.get('/knowledge/:id/attachments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      `SELECT a.*, u.name as uploader_name FROM knowledge_article_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.article_id = $1 ORDER BY a.created_at DESC`,
      [id]
    );

    return reply.send({ data: rows });
  });

  // GET /knowledge/attachments/:id/download - download file
  fastify.get('/knowledge/attachments/:id/download', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      'SELECT * FROM knowledge_article_attachments WHERE id = $1',
      [id]
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'Attachment not found' });

    const att = rows[0];
    if (!fs.existsSync(att.storage_path)) return reply.status(404).send({ error: 'File not found on disk' });

    reply.header('Content-Disposition', `inline; filename="${att.original_name}"`);
    reply.header('Content-Type', att.mime_type);
    return reply.send(fs.createReadStream(att.storage_path));
  });

  // DELETE /knowledge/attachments/:id - delete file
  fastify.delete('/knowledge/attachments/:id', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      'SELECT * FROM knowledge_article_attachments WHERE id = $1',
      [id]
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'Attachment not found' });

    const att = rows[0];
    if (fs.existsSync(att.storage_path)) fs.unlinkSync(att.storage_path);
    await pool.query('DELETE FROM knowledge_article_attachments WHERE id = $1', [id]);
    return reply.send({ data: { success: true } });
  });

  // POST /knowledge/:id/sync-ai - sync single article to AI training
  fastify.post('/knowledge/:id/sync-ai', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows: articles } = await pool.query(
      'SELECT id, title, body, tags FROM knowledge_articles WHERE id = $1 AND status = $2',
      [id, 'published']
    );
    if (articles.length === 0) return reply.status(400).send({ error: 'Article not found or not published' });

    const article = articles[0];

    const { rows: existing } = await pool.query(
      `SELECT id FROM ai_knowledge_sources WHERE source_type = 'kb_sync' AND name = $1`,
      [article.title]
    );

    let sourceId: string;
    if (existing.length > 0) {
      sourceId = existing[0].id;
      await pool.query(
        `UPDATE ai_knowledge_sources SET raw_content = $1, status = 'pending', updated_at = NOW() WHERE id = $2`,
        [article.body, sourceId]
      );
    } else {
      const { rows: newSource } = await pool.query(
        `INSERT INTO ai_knowledge_sources (name, source_type, content_type, raw_content, tags, uploaded_by, status)
         VALUES ($1, 'kb_sync', 'text/markdown', $2, $3, $4, 'pending') RETURNING id`,
        [article.title, article.body, article.tags || [], request.user.id]
      );
      sourceId = newSource[0].id;
    }

    // Async processing via dynamic import
    import('./helpers/ai-training.utils').then(async ({ processSource }) => {
      const [cfgRows, ragRows] = await Promise.all([
        pool.query('SELECT * FROM ai_config LIMIT 1'),
        pool.query('SELECT * FROM ai_rag_config LIMIT 1'),
      ]);
      const cfg = cfgRows.rows[0] ?? null;
      const ragCfg = ragRows.rows[0] ?? { chunk_size: 512, chunk_overlap: 64 };
      return processSource(sourceId, article.body, cfg, ragCfg);
    }).catch(console.error);

    return reply.send({ data: { synced: true, message: 'Article synced to AI training' } });
  });

  // GET /knowledge/stats - knowledge base analytics
  fastify.get('/knowledge/stats', { preHandler: [fastify.authenticate, fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const [totalResult, byStatus, topViewed, topHelpful, byCategory, authorStats, viewsDaily] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as total FROM knowledge_articles`),
      pool.query(`SELECT status, COUNT(*)::int as count FROM knowledge_articles GROUP BY status`),
      pool.query(`SELECT id, title, slug, views, helpful_count, not_helpful_count FROM knowledge_articles ORDER BY views DESC LIMIT 10`),
      pool.query(`
        SELECT id, title, slug, views, helpful_count, not_helpful_count,
               CASE WHEN (helpful_count + not_helpful_count) > 0 
                 THEN ROUND(helpful_count::numeric / (helpful_count + not_helpful_count) * 100, 1) 
               ELSE 0 END as helpfulness_pct
        FROM knowledge_articles 
        WHERE (helpful_count + not_helpful_count) > 0
        ORDER BY helpfulness_pct DESC LIMIT 10
      `),
      pool.query(`
        SELECT c.name as category, COUNT(*)::int as count
        FROM knowledge_articles ka LEFT JOIN categories c ON ka.category_id = c.id
        GROUP BY c.name ORDER BY count DESC
      `),
      pool.query(`
        SELECT u.name as author, COUNT(*)::int as total, SUM(ka.views)::int as total_views
        FROM knowledge_articles ka JOIN users u ON ka.author_id = u.id
        GROUP BY u.name ORDER BY total_views DESC
      `),
      pool.query(`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM knowledge_articles
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date ASC
      `),
    ]);

    return reply.send({
      data: {
        total: totalResult.rows[0].total,
        byStatus: byStatus.rows,
        topViewed: topViewed.rows,
        topHelpful: topHelpful.rows,
        byCategory: byCategory.rows,
        authorStats: authorStats.rows,
        viewsDaily: viewsDaily.rows,
      }
    });
  });
}
