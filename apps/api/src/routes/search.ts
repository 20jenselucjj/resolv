import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional().default('tickets,assets,knowledge,users'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export default async function searchRoutes(fastify: FastifyInstance) {
  // GET /search — Cross-entity full-text search
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = searchSchema.parse(request.query);
    const { q, types, limit } = query;
    const user = request.user as JwtPayload;
    const typeList = types.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const hasType = (t: string) => typeList.includes(t);

    const result: Record<string, any[]> = { tickets: [], assets: [], knowledge: [], users: [] };

    // ─── Tickets ───────────────────────────────────────────────────────────
    if (hasType('tickets')) {
      const ticketParams: any[] = [q, `%${q}%`, limit];
      let ticketWhere = '';
      let paramIdx = 3;

      // Row-level security: non-admin/agent users only see their own tickets
      if (user.role === 'user') {
        ticketWhere = ` AND (t.created_by_id = $${paramIdx} OR t.assigned_to_id = $${paramIdx})`;
        ticketParams.push(user.id);
        paramIdx++;
      }

      const ticketResults = await pool.query(
        `SELECT t.id, t.number, t.title, t.status, t.priority, t.ticket_type, t.created_at,
                ts_rank(t.search_vector, plainto_tsquery('english', $1)) as rank
         FROM tickets t
         WHERE (t.search_vector @@ plainto_tsquery('english', $1)
            OR t.title ILIKE $2
            OR t.description ILIKE $2)
              ${ticketWhere}
         ORDER BY rank DESC, t.created_at DESC
         LIMIT $3`,
        ticketParams
      );

      result.tickets = ticketResults.rows.map(r => ({
        id: r.id,
        number: r.number,
        title: r.title,
        status: r.status,
        priority: r.priority,
        ticket_type: r.ticket_type,
        created_at: r.created_at,
        highlight: r.title,
      }));
    }

    // ─── Assets ────────────────────────────────────────────────────────────
    if (hasType('assets')) {
      const assetResults = await pool.query(
        `SELECT a.id, a.name, a.display_name, a.hostname, a.serial_number, a.asset_type, a.status,
                a.manufacturer, a.model, a.ip_address, a.tags,
                ts_rank(a.search_vector, plainto_tsquery('english', $1)) as rank
         FROM assets a
         WHERE (a.search_vector @@ plainto_tsquery('english', $1)
            OR a.name ILIKE $2
            OR a.hostname ILIKE $2
            OR a.serial_number ILIKE $2
            OR a.display_name ILIKE $2)
         ORDER BY rank DESC, a.name ASC
         LIMIT $3`,
        [q, `%${q}%`, limit]
      );

      result.assets = assetResults.rows.map(r => ({
        id: r.id,
        name: r.name,
        display_name: r.display_name,
        hostname: r.hostname,
        serial_number: r.serial_number,
        asset_type: r.asset_type,
        status: r.status,
        manufacturer: r.manufacturer,
        model: r.model,
        ip_address: r.ip_address,
        tags: r.tags,
        highlight: r.name,
      }));
    }

    // ─── Knowledge Articles ───────────────────────────────────────────────
    if (hasType('knowledge')) {
      const kbParams: any[] = [`%${q}%`, limit];
      let kbWhere = '';
      let kbIdx = 2;

      // Non-admin users only see published articles
      if (user.role !== 'admin' && user.role !== 'agent') {
        kbWhere = ` AND ka.status = 'published'`;
      }

      // For agents/admins who don't specify a status filter, show all
      // We still need search vectors on knowledge — use ILIKE fallback since
      // knowledge_articles doesn't have search_vector yet in this migration
      const kbResults = await pool.query(
        `SELECT ka.id, ka.title, ka.slug, ka.status, ka.category_id, ka.created_at,
                c.name as category_name, c.color as category_color,
                u.name as author_name
         FROM knowledge_articles ka
         LEFT JOIN categories c ON ka.category_id = c.id
         LEFT JOIN users u ON ka.author_id = u.id
         WHERE (ka.title ILIKE $1 OR ka.body ILIKE $1 OR array_to_string(ka.tags, ' ') ILIKE $1)
              ${kbWhere}
         ORDER BY ka.updated_at DESC
         LIMIT $2`,
        kbParams
      );

      result.knowledge = kbResults.rows.map(r => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        status: r.status,
        category_id: r.category_id,
        category_name: r.category_name,
        category_color: r.category_color,
        author_name: r.author_name,
        created_at: r.created_at,
        highlight: r.title,
      }));
    }

    // ─── Users ────────────────────────────────────────────────────────────
    if (hasType('users')) {
      const userResults = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.department, u.title, u.avatar_url,
                u.is_active,
                ts_rank(u.search_vector, plainto_tsquery('english', $1)) as rank
         FROM users u
         WHERE (u.search_vector @@ plainto_tsquery('english', $1)
            OR u.name ILIKE $2
            OR u.email ILIKE $2
            OR u.department ILIKE $2)
         ORDER BY rank DESC, u.name ASC
         LIMIT $3`,
        [q, `%${q}%`, limit]
      );

      result.users = userResults.rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        department: r.department,
        title: r.title,
        avatar_url: r.avatar_url,
        is_active: r.is_active,
      }));
    }

    return reply.send({ data: result });
  });

  // GET /search/recent — Get recent search queries for the current user
  fastify.get('/search/recent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;

    // Store recent searches in system_settings with a predictable key
    // Each user has their own recent searches stored under a keyed entry
    const result = await pool.query(
      `SELECT value FROM system_settings WHERE key = $1`,
      [`recent_searches_${user.id}`]
    );

    let searches: string[] = [];
    if (result.rows.length > 0) {
      try {
        searches = JSON.parse(result.rows[0].value);
      } catch {
        searches = [];
      }
    }

    return reply.send({ data: searches.slice(0, 10) });
  });

  // POST /search/recent — Save a search query to recent searches
  fastify.post('/search/recent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const bodySchema = z.object({ q: z.string().min(1).max(200) });
    const { q } = bodySchema.parse(request.body);
    const user = request.user as JwtPayload;

    // Get existing recent searches
    const result = await pool.query(
      `SELECT value FROM system_settings WHERE key = $1`,
      [`recent_searches_${user.id}`]
    );

    let searches: string[] = [];
    if (result.rows.length > 0) {
      try {
        searches = JSON.parse(result.rows[0].value);
      } catch {
        searches = [];
      }
    }

    // Add new search to front, remove duplicates, keep max 10
    searches = [q, ...searches.filter(s => s !== q)].slice(0, 10);

    // Upsert into system_settings
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [`recent_searches_${user.id}`, JSON.stringify(searches)]
    );

    return reply.send({ data: searches });
  });
}
