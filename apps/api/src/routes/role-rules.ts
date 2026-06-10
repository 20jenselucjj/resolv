import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function roleRulesRoutes(fastify: FastifyInstance) {

  // ─── Zod schemas ──────────────────────────────────────────────────────────

  const conditionSchema = z.object({
    field: z.string().min(1),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in', 'starts_with', 'ends_with', 'exists', 'not_exists', 'gt', 'gte', 'lt', 'lte']),
    value: z.any(),
  });

  const createRuleSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional().default(''),
    priority: z.number().int().min(0).optional(),
    match_type: z.enum(['all', 'any']).optional().default('all'),
    conditions: z.array(conditionSchema).optional().default([]),
    role: z.enum(['admin', 'manager', 'agent', 'user', 'readonly']),
    enabled: z.boolean().optional().default(true),
  });

  const updateRuleSchema = createRuleSchema.partial().extend({
    name: z.string().min(1).max(200).optional(),
  });

  // ─── GET /admin/role-rules — list all rules ordered by priority ──────────

  fastify.get('/admin/role-rules', { preHandler: [fastify.requirePermission('manage_directory_sync')] }, async (request, reply) => {
    const result = await pool.query(
      'SELECT * FROM role_assignment_rules ORDER BY priority ASC, created_at ASC'
    );
    return reply.send({ data: result.rows });
  });

  // ─── POST /admin/role-rules — create a new rule ─────────────────────────

  fastify.post('/admin/role-rules', { preHandler: [fastify.requirePermission('manage_directory_sync')] }, async (request, reply) => {
    const body = createRuleSchema.parse(request.body);

    // Auto-assign priority if not given (after the last existing rule)
    let priority = body.priority;
    if (priority === undefined) {
      const maxResult = await pool.query('SELECT COALESCE(MAX(priority), 0) + 10 as next_priority FROM role_assignment_rules');
      priority = maxResult.rows[0].next_priority;
    }

    const result = await pool.query(
      `INSERT INTO role_assignment_rules (name, description, priority, match_type, conditions, role, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.name, body.description, priority, body.match_type, JSON.stringify(body.conditions), body.role, body.enabled]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'create_role_rule', 'role_assignment_rules', result.rows[0].id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── PUT /admin/role-rules/:id — update a rule ──────────────────────────

  fastify.put('/admin/role-rules/:id', { preHandler: [fastify.requirePermission('manage_directory_sync')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRuleSchema.parse(request.body);

    const existing = await pool.query('SELECT id FROM role_assignment_rules WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (body.name !== undefined) { setClauses.push(`name = $${paramIdx++}`); values.push(body.name); }
    if (body.description !== undefined) { setClauses.push(`description = $${paramIdx++}`); values.push(body.description); }
    if (body.priority !== undefined) { setClauses.push(`priority = $${paramIdx++}`); values.push(body.priority); }
    if (body.match_type !== undefined) { setClauses.push(`match_type = $${paramIdx++}`); values.push(body.match_type); }
    if (body.conditions !== undefined) { setClauses.push(`conditions = $${paramIdx++}`); values.push(JSON.stringify(body.conditions)); }
    if (body.role !== undefined) { setClauses.push(`role = $${paramIdx++}`); values.push(body.role); }
    if (body.enabled !== undefined) { setClauses.push(`enabled = $${paramIdx++}`); values.push(body.enabled); }

    if (setClauses.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE role_assignment_rules SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_role_rule', 'role_assignment_rules', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // ─── DELETE /admin/role-rules/:id — delete a rule ───────────────────────

  fastify.delete('/admin/role-rules/:id', { preHandler: [fastify.requirePermission('manage_directory_sync')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query('DELETE FROM role_assignment_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_role_rule', 'role_assignment_rules', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

  // ─── PATCH /admin/role-rules/reorder — batch update priorities ─────────

  const reorderSchema = z.object({
    rules: z.array(z.object({
      id: z.string().uuid(),
      priority: z.number().int().min(0),
    })),
  });

  fastify.patch('/admin/role-rules/reorder', { preHandler: [fastify.requirePermission('manage_directory_sync')] }, async (request, reply) => {
    const body = reorderSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const rule of body.rules) {
        await client.query(
          'UPDATE role_assignment_rules SET priority = $1 WHERE id = $2',
          [rule.priority, rule.id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return reply.send({ success: true });
  });

}
