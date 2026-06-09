import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function scriptRoutes(fastify: FastifyInstance) {

  // ─── Schemas ─────────────────────────────────────────────────────────────────

  const createScriptSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    category: z.string().max(100).default('general'),
    target_os: z.string().max(50).default('windows'),
    script_type: z.enum(['powershell', 'cmd', 'batch']).default('powershell'),
    script_content: z.string().min(1),
    parameters: z.array(z.object({
      name: z.string(),
      label: z.string(),
      type: z.enum(['text', 'number', 'select']),
      required: z.boolean().default(false),
      default: z.any().optional(),
      options: z.array(z.string()).optional(),
    })).default([]),
  });

  const updateScriptSchema = createScriptSchema.partial();

  const executeScriptSchema = z.object({
    script_id: z.string().uuid().optional(),
    script_content: z.string().optional(),
    script_type: z.enum(['powershell', 'cmd', 'batch']).default('powershell'),
    parameters: z.record(z.any()).default({}),
    priority: z.number().min(0).max(100).default(10),
    timeout_seconds: z.number().min(5).max(3600).default(120),
  });

  // ─── List scripts ────────────────────────────────────────────────────────────

  fastify.get('/scripts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { category, search } = request.query as any;

    let query = `SELECT s.*, u.name as created_by_name FROM scripts s LEFT JOIN users u ON s.created_by = u.id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (category) {
      query += ` AND s.category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (s.name ILIKE $${idx} OR s.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY s.category, s.name`;

    const result = await pool.query(query, params);
    return reply.send({ data: result.rows });
  });

  // ─── Get script categories ────────────────────────────────────────────────────

  fastify.get('/scripts/categories', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    const result = await pool.query(
      `SELECT DISTINCT category, COUNT(*)::int as count FROM scripts GROUP BY category ORDER BY category`
    );
    return reply.send({ data: result.rows });
  });

  // ─── Get single script ────────────────────────────────────────────────────────

  fastify.get('/scripts/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT s.*, u.name as created_by_name FROM scripts s LEFT JOIN users u ON s.created_by = u.id WHERE s.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Script not found' });
    return reply.send({ data: result.rows[0] });
  });

  // ─── Create script ─────────────────────────────────────────────────────────────

  fastify.post('/scripts', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const body = createScriptSchema.parse(request.body);
    const userId = request.user.id;

    const result = await pool.query(`
      INSERT INTO scripts (name, description, category, target_os, script_type, script_content, parameters, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      body.name, body.description || null, body.category, body.target_os,
      body.script_type, body.script_content, JSON.stringify(body.parameters), userId,
    ]);

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── Update script ─────────────────────────────────────────────────────────────

  fastify.patch('/scripts/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const body = updateScriptSchema.parse(request.body);

    const existing = await pool.query(`SELECT id FROM scripts WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Script not found' });

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        if (key === 'parameters') {
          sets.push(`${key} = $${idx++}`);
          params.push(JSON.stringify(value));
        } else {
          sets.push(`${key} = $${idx++}`);
          params.push(value);
        }
      }
    }

    if (sets.length === 0) return reply.status(400).send({ error: 'No fields to update' });

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE scripts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    return reply.send({ data: result.rows[0] });
  });

  // ─── Delete script ─────────────────────────────────────────────────────────────

  fastify.delete('/scripts/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await pool.query(`SELECT id FROM scripts WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Script not found' });

    await pool.query(`DELETE FROM scripts WHERE id = $1`, [id]);
    return reply.send({ data: { ok: true } });
  });

  // ─── Execute script on asset ───────────────────────────────────────────────────
  // Creates an agent_command to run the script on the target asset

  fastify.post('/assets/:id/scripts/execute', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const body = executeScriptSchema.parse(request.body);
    const userId = request.user.id;

    // Verify asset exists
    const assetCheck = await pool.query(`SELECT id FROM assets WHERE id = $1`, [id]);
    if (assetCheck.rows.length === 0) return reply.status(404).send({ error: 'Asset not found' });

    // Resolve script content
    let scriptContent = body.script_content || '';
    let scriptType = body.script_type;
    let scriptName = 'Custom Script';

    if (body.script_id) {
      const scriptResult = await pool.query(`SELECT * FROM scripts WHERE id = $1`, [body.script_id]);
      if (scriptResult.rows.length === 0) return reply.status(404).send({ error: 'Script not found' });
      const script = scriptResult.rows[0];
      scriptContent = script.script_content;
      scriptType = script.script_type;
      scriptName = script.name;

      // Substitute parameters in script content
      for (const [key, value] of Object.entries(body.parameters)) {
        scriptContent = scriptContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    }

    if (!scriptContent) return reply.status(400).send({ error: 'No script content provided' });

    const expiresAt = new Date(Date.now() + 168 * 60 * 60 * 1000); // 7 days

    const cmdResult = await pool.query(`
      INSERT INTO agent_commands (asset_id, created_by, command_type, payload, priority, timeout_seconds, max_retries, expires_at)
      VALUES ($1, $2, 'run_script', $3, $4, $5, 3, $6)
      RETURNING id, command_type, status, payload, priority, created_at
    `, [
      id, userId,
      JSON.stringify({ script: scriptContent, type: scriptType, script_name: scriptName }),
      body.priority, body.timeout_seconds, expiresAt,
    ]);

    // Log activity
    await pool.query(
      `INSERT INTO asset_activity (asset_id, actor_id, action, description) VALUES ($1, $2, 'script_executed', $3)`,
      [id, userId, `Script executed: ${scriptName}`]
    );

    // Notify agent via WebSocket
    const fastifyInstance = request.server as any;
    fastifyInstance.io.to(`asset:${id}`).emit('agent:command:new', {
      assetId: id,
      commandId: cmdResult.rows[0].id,
      command_type: 'run_script',
    });

    return reply.status(201).send({ data: cmdResult.rows[0] });
  });
}
