import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

const ciTypeEnum = z.enum([
  'server', 'workstation', 'laptop', 'network_device', 'storage', 'database',
  'application', 'service', 'virtual_machine', 'container', 'middleware',
  'load_balancer', 'firewall', 'certificate', 'dns_record', 'cloud_resource',
  'kubernetes_cluster', 'other',
]);

const ciStatusEnum = z.enum(['active', 'inactive', 'maintenance', 'retired']);

const relationshipTypeEnum = z.enum([
  'depends_on', 'runs_on', 'connects_to', 'contains', 'member_of',
  'provides', 'uses', 'backed_by',
]);

const createCiSchema = z.object({
  name: z.string().min(3).max(500),
  description: z.string().default(''),
  ci_type: ciTypeEnum,
  asset_id: z.string().uuid().nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  status: ciStatusEnum.default('active'),
  tags: z.array(z.string()).default([]),
});

const updateCiSchema = z.object({
  name: z.string().min(3).max(500).optional(),
  description: z.string().optional(),
  ci_type: ciTypeEnum.optional(),
  asset_id: z.string().uuid().nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  status: ciStatusEnum.optional(),
  tags: z.array(z.string()).optional(),
});

const createRelationshipSchema = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relationship_type: relationshipTypeEnum,
  description: z.string().default(''),
});

const linkToAssetSchema = z.object({
  ci_id: z.string().uuid(),
  asset_id: z.string().uuid(),
});

export default async function cmdbRoutes(fastify: FastifyInstance) {

  // ─────────────────────────────────────────────────────────
  //  HELPER: fetch single CI with owner info
  // ─────────────────────────────────────────────────────────
  async function fetchCi(id: string) {
    const result = await pool.query(
      `SELECT ci.*,
              u.name as owner_name,
              a.name as asset_name,
               a.asset_type
       FROM configuration_items ci
       LEFT JOIN users u ON ci.owner_id = u.id
       LEFT JOIN assets a ON ci.asset_id = a.id
       WHERE ci.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  // ─────────────────────────────────────────────────────────
  //  GET /cmdb — list configuration items with search, filters, pagination
  // ─────────────────────────────────────────────────────────
  fastify.get('/cmdb', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(25),
      ci_type: ciTypeEnum.optional(),
      status: ciStatusEnum.optional(),
      owner_id: z.string().uuid().optional(),
      asset_id: z.string().uuid().optional(),
      tag: z.string().max(200).optional(),
      search: z.string().max(200).optional(),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.ci_type) {
      whereClause += ` AND ci.ci_type = $${paramIdx++}`;
      params.push(query.ci_type);
    }
    if (query.status) {
      whereClause += ` AND ci.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.owner_id) {
      whereClause += ` AND ci.owner_id = $${paramIdx++}`;
      params.push(query.owner_id);
    }
    if (query.asset_id) {
      whereClause += ` AND ci.asset_id = $${paramIdx++}`;
      params.push(query.asset_id);
    }
    if (query.tag) {
      whereClause += ` AND $${paramIdx} = ANY(ci.tags)`;
      params.push(query.tag);
      paramIdx++;
    }
    if (query.search) {
      whereClause += ` AND (ci.name ILIKE $${paramIdx} OR ci.description ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM configuration_items ci ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT ci.*,
              u.name as owner_name
       FROM configuration_items ci
       LEFT JOIN users u ON ci.owner_id = u.id
       ${whereClause}
       ORDER BY ci.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, query.pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /cmdb/:id — single CI with relationships
  // ─────────────────────────────────────────────────────────
  fastify.get('/cmdb/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const ci = await fetchCi(id);
    if (!ci) {
      return reply.status(404).send({ error: 'Configuration item not found' });
    }

    // Get relationships (both directions)
    const relationships = await pool.query(
      `SELECT r.*,
              source.name as source_name, source.ci_type as source_type,
              target.name as target_name, target.ci_type as target_type
       FROM ci_relationships r
       LEFT JOIN configuration_items source ON r.source_id = source.id
       LEFT JOIN configuration_items target ON r.target_id = target.id
       WHERE r.source_id = $1 OR r.target_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    return reply.send({
      data: {
        ...ci,
        relationships: relationships.rows,
      },
    });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /cmdb/:id/graph — relationship graph for a CI
  // ─────────────────────────────────────────────────────────
  fastify.get('/cmdb/:id/graph', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const ci = await fetchCi(id);
    if (!ci) {
      return reply.status(404).send({ error: 'Configuration item not found' });
    }

    // Get all relationships connected to this CI (bidirectional)
    const relationshipsResult = await pool.query(
      `SELECT r.*,
              source.name as source_name, source.ci_type as source_type,
              target.name as target_name, target.ci_type as target_type
       FROM ci_relationships r
       LEFT JOIN configuration_items source ON r.source_id = source.id
       LEFT JOIN configuration_items target ON r.target_id = target.id
       WHERE r.source_id = $1 OR r.target_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    // Build connected items list with direction annotation
    const relationships = relationshipsResult.rows.map((r: any) => ({
      source: { id: r.source_id, name: r.source_name, ci_type: r.source_type },
      target: { id: r.target_id, name: r.target_name, ci_type: r.target_type },
      type: r.relationship_type,
      direction: r.source_id === id ? 'outgoing' : 'incoming' as 'outgoing' | 'incoming',
    }));

    return reply.send({
      data: {
        center: ci,
        relationships,
      },
    });
  });

  // ─────────────────────────────────────────────────────────
  //  POST /cmdb — create configuration item
  // ─────────────────────────────────────────────────────────
  fastify.post('/cmdb', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const body = createCiSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO configuration_items (name, description, ci_type, asset_id, department, location, owner_id, status, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [body.name, body.description, body.ci_type,
         body.asset_id || null, body.department || null, body.location || null,
         body.owner_id || null, body.status, body.tags]
      );

      const rawCi = result.rows[0];

      await client.query('COMMIT');

      const ci = await fetchCi(rawCi.id);

      return reply.status(201).send({ data: ci });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  PATCH /cmdb/:id — update configuration item
  // ─────────────────────────────────────────────────────────
  fastify.patch('/cmdb/:id', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCiSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM configuration_items WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Configuration item not found' });
      }

      const ci = current.rows[0];

      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (body.name !== undefined) { updates.push(`name = $${paramIdx++}`); params.push(body.name); }
      if (body.description !== undefined) { updates.push(`description = $${paramIdx++}`); params.push(body.description); }
      if (body.ci_type !== undefined) { updates.push(`ci_type = $${paramIdx++}`); params.push(body.ci_type); }
      if (body.asset_id !== undefined) { updates.push(`asset_id = $${paramIdx++}`); params.push(body.asset_id); }
      if (body.department !== undefined) { updates.push(`department = $${paramIdx++}`); params.push(body.department); }
      if (body.location !== undefined) { updates.push(`location = $${paramIdx++}`); params.push(body.location); }
      if (body.owner_id !== undefined) { updates.push(`owner_id = $${paramIdx++}`); params.push(body.owner_id); }
      if (body.status !== undefined) { updates.push(`status = $${paramIdx++}`); params.push(body.status); }
      if (body.tags !== undefined) { updates.push(`tags = $${paramIdx++}`); params.push(body.tags); }

      if (updates.length > 0) {
        params.push(id);
        await client.query(
          `UPDATE configuration_items SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
          params
        );
      }

      await client.query('COMMIT');

      const updatedCi = await fetchCi(id);

      return reply.send({ data: updatedCi });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  DELETE /cmdb/:id — delete configuration item (cascades to relationships)
  // ─────────────────────────────────────────────────────────
  fastify.delete('/cmdb/:id', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const current = await pool.query('SELECT id FROM configuration_items WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ error: 'Configuration item not found' });
    }

    await pool.query('DELETE FROM configuration_items WHERE id = $1', [id]);
    return reply.status(204).send();
  });

  // ─────────────────────────────────────────────────────────
  //  POST /cmdb/relationships — create relationship between CIs
  // ─────────────────────────────────────────────────────────
  fastify.post('/cmdb/relationships', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createRelationshipSchema.parse(request.body);

    if (body.source_id === body.target_id) {
      return reply.status(400).send({ error: 'A configuration item cannot have a relationship with itself' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify both CIs exist
      const sourceCheck = await client.query('SELECT id, name FROM configuration_items WHERE id = $1', [body.source_id]);
      if (sourceCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Source configuration item not found' });
      }

      const targetCheck = await client.query('SELECT id, name FROM configuration_items WHERE id = $1', [body.target_id]);
      if (targetCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Target configuration item not found' });
      }

      const result = await client.query(
        `INSERT INTO ci_relationships (source_id, target_id, relationship_type, description)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [body.source_id, body.target_id, body.relationship_type, body.description]
      );

      await client.query('COMMIT');

      return reply.status(201).send({ data: result.rows[0] });
    } catch (error: any) {
      await client.query('ROLLBACK');

      // Handle unique constraint violation
      if (error.code === '23505') {
        return reply.status(409).send({ error: 'This relationship already exists' });
      }

      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  DELETE /cmdb/relationships/:id — delete relationship
  // ─────────────────────────────────────────────────────────
  fastify.delete('/cmdb/relationships/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const current = await pool.query('SELECT id FROM ci_relationships WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ error: 'Relationship not found' });
    }

    await pool.query('DELETE FROM ci_relationships WHERE id = $1', [id]);
    return reply.status(204).send();
  });

  // ─────────────────────────────────────────────────────────
  //  POST /cmdb/link-to-asset — link a CI to an existing asset
  // ─────────────────────────────────────────────────────────
  fastify.post('/cmdb/link-to-asset', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const body = linkToAssetSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify CI exists
      const ciCheck = await client.query('SELECT id, name FROM configuration_items WHERE id = $1', [body.ci_id]);
      if (ciCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Configuration item not found' });
      }

      // Verify asset exists
      const assetCheck = await client.query('SELECT id, name FROM assets WHERE id = $1', [body.asset_id]);
      if (assetCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Asset not found' });
      }

      await client.query(
        `UPDATE configuration_items SET asset_id = $1 WHERE id = $2`,
        [body.asset_id, body.ci_id]
      );

      await client.query('COMMIT');

      const updatedCi = await fetchCi(body.ci_id);
      return reply.send({ data: updatedCi });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  Health Scoring
  // ─────────────────────────────────────────────────────────

  /**
   * Compute health_score (0-100) and health_status for a CI.
   */
  async function computeHealth(ci: any): Promise<{ health_score: number; health_status: string }> {
    let score = 0;

    // 1. Active status: +25pts
    if (ci.status === 'active') score += 25;

    // 2. Has version: +15pts
    if (ci.version && ci.version.trim()) score += 15;

    // 3. Has location or department: +15pts
    if ((ci.location && ci.location.trim()) || (ci.department && ci.department.trim())) score += 15;

    // 4. Has assigned_to (owner_id): +15pts
    if (ci.owner_id) score += 15;

    // 5. Has CI relationships: +15pts
    if (ci.relationship_count > 0) score += 15;

    // 6. Has tags or last_seen: +15pts
    const hasTags = Array.isArray(ci.tags) && ci.tags.length > 0;
    const hasLastSeen = ci.last_seen != null;
    if (hasTags || hasLastSeen) score += 15;

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    let status: string;
    if (score < 31) status = 'critical';
    else if (score < 51) status = 'poor';
    else if (score < 71) status = 'fair';
    else if (score < 86) status = 'good';
    else status = 'excellent';

    return { health_score: score, health_status: status };
  }

  // ─────────────────────────────────────────────────────────
  //  POST /cmdb/ci/:id/assess-health — assess one CI
  // ─────────────────────────────────────────────────────────
  fastify.post('/cmdb/ci/:id/assess-health', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Fetch CI with relationship count
    const ciResult = await pool.query(
      `SELECT ci.*,
              (SELECT COUNT(*) FROM ci_relationships r WHERE r.source_id = ci.id OR r.target_id = ci.id) AS relationship_count
       FROM configuration_items ci
       WHERE ci.id = $1`,
      [id]
    );
    if (ciResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Configuration item not found' });
    }

    const ci = ciResult.rows[0];
    const { health_score, health_status } = await computeHealth(ci);

    const updated = await pool.query(
      `UPDATE configuration_items
       SET health_score = $1, health_status = $2, last_assessed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [health_score, health_status, id]
    );

    const result = await fetchCi(id);
    return reply.send({ data: { ...result, health_score, health_status, last_assessed_at: updated.rows[0].last_assessed_at } });
  });

  // ─────────────────────────────────────────────────────────
  //  POST /cmdb/assess-all-health — assess all CIs
  // ─────────────────────────────────────────────────────────
  fastify.post('/cmdb/assess-all-health', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const allCis = await pool.query(
      `SELECT ci.*,
              (SELECT COUNT(*) FROM ci_relationships r WHERE r.source_id = ci.id OR r.target_id = ci.id) AS relationship_count
       FROM configuration_items ci`
    );

    const results: any[] = [];
    for (const ci of allCis.rows) {
      const { health_score, health_status } = await computeHealth(ci);
      await pool.query(
        `UPDATE configuration_items
         SET health_score = $1, health_status = $2, last_assessed_at = NOW()
         WHERE id = $3`,
        [health_score, health_status, ci.id]
      );
      results.push({ id: ci.id, name: ci.name, health_score, health_status });
    }

    return reply.send({ assessed: results.length, results });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /cmdb/health-summary — aggregate health stats
  // ─────────────────────────────────────────────────────────
  fastify.get('/cmdb/health-summary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const aggResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(health_score)::int AS assessed,
         ROUND(AVG(health_score))::int AS average_health_score,
         COALESCE(jsonb_object_agg(COALESCE(health_status, 'unknown'), cnt) FILTER (WHERE health_status IS NOT NULL), '{}'::jsonb) AS health_status_breakdown
       FROM (
         SELECT
           health_status,
           COUNT(*)::int AS cnt
         FROM configuration_items
         GROUP BY health_status
       ) sub`
    );

    const needsAttention = await pool.query(
      `SELECT id, name, health_score, health_status, ci_type, status
       FROM configuration_items
       WHERE health_score IS NOT NULL AND health_score < 50
       ORDER BY health_score ASC
       LIMIT 50`
    );

    return reply.send({
      data: aggResult.rows[0],
      needs_attention: needsAttention.rows,
    });
  });

  // ─────────────────────────────────────────────────────────
  //  Baselines
  // ─────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────
  //  POST /cmdb/ci/:id/baseline — capture a baseline snapshot
  // ─────────────────────────────────────────────────────────
  fastify.post('/cmdb/ci/:id/baseline', { preHandler: [fastify.requirePermission('manage_cmdb')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodySchema = z.object({
      label: z.string().min(1).max(500),
      notes: z.string().max(2000).default(''),
    });
    const body = bodySchema.parse(request.body);

    // Fetch current CI data
    const ciResult = await pool.query('SELECT * FROM configuration_items WHERE id = $1', [id]);
    if (ciResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Configuration item not found' });
    }

    const ci = ciResult.rows[0];
    const snapshot = {
      name: ci.name,
      description: ci.description,
      ci_type: ci.ci_type,
      asset_id: ci.asset_id,
      department: ci.department,
      location: ci.location,
      owner_id: ci.owner_id,
      status: ci.status,
      tags: ci.tags,
      version: ci.version,
      health_score: ci.health_score,
      health_status: ci.health_status,
    };

    const user = (request as any).user;

    const result = await pool.query(
      `INSERT INTO ci_baselines (ci_id, label, snapshot, created_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, body.label, JSON.stringify(snapshot), user?.id || null, body.notes]
    );

    // Update last_baseline_at on CI
    await pool.query('UPDATE configuration_items SET baseline_snapshot = $1, last_baseline_at = NOW() WHERE id = $2',
      [JSON.stringify(snapshot), id]);

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /cmdb/ci/:id/baselines — list baselines for a CI
  // ─────────────────────────────────────────────────────────
  fastify.get('/cmdb/ci/:id/baselines', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM ci_baselines WHERE ci_id = $1',
      [id]
    );

    const result = await pool.query(
      `SELECT b.*, u.name AS created_by_name
       FROM ci_baselines b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.ci_id = $1
       ORDER BY b.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, query.pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /cmdb/ci/:id/compare/:baselineId — diff CI vs baseline
  // ─────────────────────────────────────────────────────────
  fastify.get('/cmdb/ci/:id/compare/:baselineId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id, baselineId } = request.params as { id: string; baselineId: string };

    const ciResult = await pool.query('SELECT * FROM configuration_items WHERE id = $1', [id]);
    if (ciResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Configuration item not found' });
    }

    const baselineResult = await pool.query('SELECT * FROM ci_baselines WHERE id = $1 AND ci_id = $2', [baselineId, id]);
    if (baselineResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Baseline not found for this CI' });
    }

    const ci = ciResult.rows[0];
    const baseline = baselineResult.rows[0];
    const snapshot = baseline.snapshot;

    // Compare fields
    const trackedFields = ['name', 'description', 'ci_type', 'department', 'location', 'owner_id', 'status', 'tags', 'version', 'health_score', 'health_status'];
    const diffs: Array<{ field: string; old_value: any; new_value: any; type: 'changed' | 'added' | 'removed' }> = [];

    for (const field of trackedFields) {
      const oldVal = snapshot ? snapshot[field] : undefined;
      const newVal = ci[field];

      const oldStr = oldVal !== undefined && oldVal !== null ? JSON.stringify(oldVal) : undefined;
      const newStr = newVal !== undefined && newVal !== null ? JSON.stringify(newVal) : undefined;

      if (oldStr === undefined && newStr !== undefined) {
        diffs.push({ field, old_value: null, new_value: newVal, type: 'added' });
      } else if (oldStr !== undefined && newStr === undefined) {
        diffs.push({ field, old_value: oldVal, new_value: null, type: 'removed' });
      } else if (oldStr !== newStr) {
        diffs.push({ field, old_value: oldVal, new_value: newVal, type: 'changed' });
      }
    }

    return reply.send({
      data: {
        baseline_label: baseline.label,
        baseline_created_at: baseline.created_at,
        baseline_notes: baseline.notes,
        diffs,
      },
    });
  });
}
