import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function softwarePackageRoutes(fastify: FastifyInstance) {
  // ─── Schemas ───────────────────────────────────────────────────────

  const createPackageSchema = z.object({
    name: z.string().min(1).max(200),
    version: z.string().max(100).optional(),
    description: z.string().optional(),
    publisher: z.string().max(200).optional(),
    category: z.string().max(100).default('general'),
    installer_url: z.string().url().optional(),
    install_command: z.string().min(1),
    uninstall_command: z.string().optional(),
    install_context: z.enum(['system', 'user']).default('system'),
    supported_os: z.string().max(50).default('windows'),
    architecture: z.enum(['x64', 'x86', 'arm64', 'any']).default('x64'),
    file_size_bytes: z.number().optional(),
    icon_url: z.string().url().optional(),
    homepage_url: z.string().url().optional(),
  });

  const updatePackageSchema = createPackageSchema.partial();

  const deploySchema = z.object({
    package_id: z.string().uuid(),
    action: z.enum(['install', 'uninstall']).default('install'),
    priority: z.number().min(0).max(100).default(20),
    timeout_seconds: z.number().min(30).max(7200).default(600),
  });

  // ─── List packages ─────────────────────────────────────────────────

  fastify.get('/software-packages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { category, search, active } = request.query as any;

    let query = `SELECT sp.*, u.name as created_by_name FROM software_packages sp LEFT JOIN users u ON sp.created_by = u.id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (category) {
      query += ` AND sp.category = $${idx++}`;
      params.push(category);
    }
    if (active !== undefined) {
      query += ` AND sp.is_active = $${idx++}`;
      params.push(active === 'true');
    }
    if (search) {
      query += ` AND (sp.name ILIKE $${idx} OR sp.publisher ILIKE $${idx} OR sp.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY sp.is_active DESC, sp.name`;

    const result = await pool.query(query, params);
    return reply.send({ data: result.rows });
  });

  // ─── Get package categories ────────────────────────────────────────

  fastify.get('/software-packages/categories', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    const result = await pool.query(`SELECT DISTINCT category, COUNT(*) as count FROM software_packages WHERE is_active = true GROUP BY category ORDER BY category`);
    return reply.send({ data: result.rows });
  });

  // ─── Get single package ────────────────────────────────────────────

  fastify.get('/software-packages/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT sp.*, u.name as created_by_name FROM software_packages sp LEFT JOIN users u ON sp.created_by = u.id WHERE sp.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Package not found' });
    return reply.send({ data: result.rows[0] });
  });

  // ─── Create package ────────────────────────────────────────────────

  fastify.post('/software-packages', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const body = createPackageSchema.parse(request.body);
    const userId = request.user.id;

    const result = await pool.query(`
      INSERT INTO software_packages (name, version, description, publisher, category, installer_url, install_command, uninstall_command, install_context, supported_os, architecture, file_size_bytes, icon_url, homepage_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      body.name, body.version || null, body.description || null, body.publisher || null,
      body.category, body.installer_url || null, body.install_command, body.uninstall_command || null,
      body.install_context, body.supported_os, body.architecture, body.file_size_bytes || null,
      body.icon_url || null, body.homepage_url || null, userId,
    ]);

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── Update package ────────────────────────────────────────────────

  fastify.patch('/software-packages/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updatePackageSchema.parse(request.body);

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }

    if (sets.length === 0) return reply.status(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE software_packages SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) return reply.status(404).send({ error: 'Package not found' });
    return reply.send({ data: result.rows[0] });
  });

  // ─── Delete package (soft-delete) ──────────────────────────────────

  fastify.delete('/software-packages/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`UPDATE software_packages SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Package not found' });
    return reply.send({ data: { ok: true } });
  });

  // ─── Deploy package to asset ───────────────────────────────────────
  // Creates an agent_command and a software_deployments tracking row

  fastify.post('/assets/:id/software/deploy', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const assetId = request.params.id;
    const body = deploySchema.parse(request.body);
    const userId = request.user.id;

    // Verify asset exists
    const assetCheck = await pool.query(`SELECT id FROM assets WHERE id = $1`, [assetId]);
    if (assetCheck.rows.length === 0) return reply.status(404).send({ error: 'Asset not found' });

    // Get package
    const pkgResult = await pool.query(`SELECT * FROM software_packages WHERE id = $1 AND is_active = true`, [body.package_id]);
    if (pkgResult.rows.length === 0) return reply.status(404).send({ error: 'Package not found' });
    const pkg = pkgResult.rows[0];

    // Determine command type and payload
    const commandType = body.action === 'uninstall' ? 'uninstall_software' : 'install_software';
    const command = body.action === 'uninstall' ? (pkg.uninstall_command || '') : pkg.install_command;

    if (!command) {
      return reply.status(400).send({ error: `No ${body.action} command configured for this package` });
    }

    const payload = body.action === 'uninstall'
      ? { name: pkg.name, uninstall_command: command }
      : { name: pkg.name, install_command: command, ...(pkg.installer_url ? { installer_url: pkg.installer_url } : {}) };

    const expiresAt = new Date(Date.now() + 168 * 60 * 60 * 1000); // 7 days

    // Create command
    const cmdResult = await pool.query(`
      INSERT INTO agent_commands (asset_id, created_by, command_type, payload, priority, timeout_seconds, max_retries, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, 3, $7)
      RETURNING id, command_type, status, payload, priority, created_at
    `, [
      assetId, userId, commandType, JSON.stringify(payload),
      body.priority, body.timeout_seconds, expiresAt,
    ]);

    // Create deployment tracking row
    await pool.query(`
      INSERT INTO software_deployments (package_id, asset_id, command_id, action, status, deployed_by)
      VALUES ($1, $2, $3, $4, 'deployed', $5)
    `, [body.package_id, assetId, cmdResult.rows[0].id, body.action, userId]);

    // Increment deploy count
    await pool.query(`UPDATE software_packages SET deploy_count = deploy_count + 1 WHERE id = $1`, [body.package_id]);

    // Log activity
    await pool.query(
      `INSERT INTO asset_activity (asset_id, actor_id, action, description) VALUES ($1, $2, $3, $4)`,
      [assetId, userId, body.action === 'uninstall' ? 'software_uninstalled' : 'software_deployed', `${body.action}: ${pkg.name} ${pkg.version || ''}`.trim()]
    );

    // Notify agent via WebSocket
    const fastifyInstance = request.server as any;
    fastifyInstance.io.to(`asset:${assetId}`).emit('agent:command:new', {
      assetId,
      commandId: cmdResult.rows[0].id,
      command_type: commandType,
    });

    return reply.status(201).send({ data: { command: cmdResult.rows[0], package: { name: pkg.name, version: pkg.version, action: body.action } } });
  });

  // ─── Deployment history for asset ──────────────────────────────────

  fastify.get('/assets/:id/software/deployments', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply) => {
    const assetId = request.params.id;

    const result = await pool.query(`
      SELECT sd.*, sp.name as package_name, sp.version as package_version, u.name as deployed_by_name
      FROM software_deployments sd
      JOIN software_packages sp ON sd.package_id = sp.id
      LEFT JOIN users u ON sd.deployed_by = u.id
      WHERE sd.asset_id = $1
      ORDER BY sd.deployed_at DESC
      LIMIT 100
    `, [assetId]);

    return reply.send({ data: result.rows });
  });
}
