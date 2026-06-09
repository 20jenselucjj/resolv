import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function agentVersionRoutes(fastify: FastifyInstance) {
  // ─── Schemas ───────────────────────────────────────────────────────

  const createVersionSchema = z.object({
    version: z.string().min(1).max(50).regex(/^\d+\.\d+\.\d+$/, 'Must be semver format (e.g. 1.2.3)'),
    changelog: z.string().optional(),
    download_url: z.string().url().optional(),
    file_size_bytes: z.number().optional(),
    checksum_sha256: z.string().max(64).optional(),
    rollout_percentage: z.number().min(0).max(100).default(100),
    min_agent_version: z.string().optional(),
    is_latest: z.boolean().default(false),
  });

  const updateVersionSchema = createVersionSchema.partial().omit({ version: true });

  // ─── Agent-facing: Check for updates ───────────────────────────────
  // Called by agent during heartbeat or checkin

  fastify.get('/assets/agent/version', async (request: any, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Missing agent token' });
    const agentToken = authHeader.slice(7);

    // Verify agent token and get current version
    const assetResult = await pool.query(
      `SELECT id, agent_version FROM assets WHERE agent_token = $1`,
      [agentToken]
    );
    if (assetResult.rows.length === 0) return reply.status(401).send({ error: 'Invalid agent token' });

    const currentVersion = assetResult.rows[0].agent_version;

    // Get latest active version
    const latestResult = await pool.query(
      `SELECT version, download_url, checksum_sha256, file_size_bytes, changelog, rollout_percentage, min_agent_version
       FROM agent_versions WHERE is_active = true AND is_latest = true LIMIT 1`
    );

    if (latestResult.rows.length === 0) {
      return reply.send({ data: { update_available: false } });
    }

    const latest = latestResult.rows[0];

    // Check if update is available
    const updateAvailable = compareVersions(latest.version, currentVersion || '0.0.0') > 0;

    // Check rollout percentage (deterministic based on asset_id hash)
    let eligibleForUpdate = updateAvailable;
    if (updateAvailable && latest.rollout_percentage < 100) {
      const assetId = assetResult.rows[0].id;
      const hash = simpleHash(assetId);
      eligibleForUpdate = (hash % 100) < latest.rollout_percentage;
    }

    return reply.send({
      data: {
        update_available: eligibleForUpdate,
        latest_version: latest.version,
        current_version: currentVersion,
        download_url: latest.download_url,
        checksum_sha256: latest.checksum_sha256,
        file_size_bytes: latest.file_size_bytes,
        changelog: latest.changelog,
      }
    });
  });

  // ─── Admin: Get latest version (lightweight, for admin UI) ──────────

  fastify.get('/agent-versions/latest', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    const result = await pool.query(`
      SELECT version, file_size_bytes, changelog, checksum_sha256, rollout_percentage, created_at
      FROM agent_versions WHERE is_active = true AND is_latest = true LIMIT 1
    `);
    if (result.rows.length === 0) return reply.send({ data: null });
    return reply.send({ data: result.rows[0] });
  });

  // ─── Admin: List versions ──────────────────────────────────────────

  fastify.get('/agent-versions', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_assets')],
  }, async (_request, reply) => {
    const result = await pool.query(`
      SELECT av.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM assets WHERE agent_version = av.version) as agent_count
      FROM agent_versions av
      LEFT JOIN users u ON av.created_by = u.id
      ORDER BY av.created_at DESC
    `);
    return reply.send({ data: result.rows });
  });

  // ─── Admin: Create version ─────────────────────────────────────────

  fastify.post('/agent-versions', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_assets')],
  }, async (request: any, reply) => {
    const body = createVersionSchema.parse(request.body);
    const userId = request.user.id;

    // If this is marked as latest, unset other latest versions
    if (body.is_latest) {
      await pool.query(`UPDATE agent_versions SET is_latest = false WHERE is_latest = true`);
    }

    const result = await pool.query(`
      INSERT INTO agent_versions (version, changelog, download_url, file_size_bytes, checksum_sha256, rollout_percentage, min_agent_version, is_latest, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      body.version, body.changelog || null, body.download_url || null,
      body.file_size_bytes || null, body.checksum_sha256 || null,
      body.rollout_percentage, body.min_agent_version || null,
      body.is_latest, userId,
    ]);

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── Admin: Update version ─────────────────────────────────────────

  fastify.patch('/agent-versions/:id', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_assets')],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const body = updateVersionSchema.parse(request.body);

    // If setting as latest, unset others
    if (body.is_latest) {
      await pool.query(`UPDATE agent_versions SET is_latest = false WHERE is_latest = true`);
    }

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
      `UPDATE agent_versions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) return reply.status(404).send({ error: 'Version not found' });
    return reply.send({ data: result.rows[0] });
  });

  // ─── Admin: Delete version ─────────────────────────────────────────

  fastify.delete('/agent-versions/:id', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_assets')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM agent_versions WHERE id = $1`, [id]);
    return reply.send({ data: { ok: true } });
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Compare two semver strings. Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Simple deterministic hash for rollout percentage calculation.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
