import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function approvalRoutingRulesRoutes(fastify: FastifyInstance) {

  // ─── Zod schemas ──────────────────────────────────────────────────────────

  const stepDefSchema = z.object({
    type: z.enum(['role', 'manager_of_requester', 'user', 'any_role']),
    role: z.string().optional(),
    user_id: z.string().uuid().optional(),
  });

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
    match_criteria: z.array(conditionSchema).optional().default([]),
    steps: z.array(stepDefSchema).min(1, 'At least one approval step is required'),
    enabled: z.boolean().optional().default(true),
  });

  const updateRuleSchema = createRuleSchema.partial();

  // ─── GET /admin/approval-routing-rules — list all ───────────────────────

  fastify.get('/admin/approval-routing-rules', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { limit: queryLimit, offset: queryOffset } = request.query as any;
    const limit = Math.min(Math.abs(parseInt(queryLimit as string, 10) || 50), 100);
    const offset = Math.max(parseInt(queryOffset as string, 10) || 0, 0);

    const result = await pool.query(
      'SELECT * FROM approval_routing_rules ORDER BY priority ASC, created_at ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return reply.send({ data: result.rows });
  });

  // ─── POST /admin/approval-routing-rules — create ───────────────────────

  fastify.post('/admin/approval-routing-rules', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = createRuleSchema.parse(request.body);

    let priority = body.priority;
    if (priority === undefined) {
      const maxResult = await pool.query('SELECT COALESCE(MAX(priority), 0) + 10 as next_priority FROM approval_routing_rules');
      priority = maxResult.rows[0].next_priority;
    }

    const result = await pool.query(
      `INSERT INTO approval_routing_rules (name, description, priority, match_type, match_criteria, steps, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.name, body.description, priority, body.match_type, JSON.stringify(body.match_criteria), JSON.stringify(body.steps), body.enabled]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'create_approval_routing_rule', 'approval_routing_rules', result.rows[0].id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── PUT /admin/approval-routing-rules/:id — update ────────────────────

  fastify.put('/admin/approval-routing-rules/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRuleSchema.parse(request.body);

    const existing = await pool.query('SELECT id FROM approval_routing_rules WHERE id = $1', [id]);
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
    if (body.match_criteria !== undefined) { setClauses.push(`match_criteria = $${paramIdx++}`); values.push(JSON.stringify(body.match_criteria)); }
    if (body.steps !== undefined) { setClauses.push(`steps = $${paramIdx++}`); values.push(JSON.stringify(body.steps)); }
    if (body.enabled !== undefined) { setClauses.push(`enabled = $${paramIdx++}`); values.push(body.enabled); }

    if (setClauses.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE approval_routing_rules SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_approval_routing_rule', 'approval_routing_rules', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // ─── DELETE /admin/approval-routing-rules/:id — delete ─────────────────

  fastify.delete('/admin/approval-routing-rules/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query('DELETE FROM approval_routing_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_approval_routing_rule', 'approval_routing_rules', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

}
