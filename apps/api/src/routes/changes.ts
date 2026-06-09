import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

const createChangeSchema = z.object({
  title: z.string().min(3).max(500),
  description: z.string().default(''),
  change_type: z.enum(['standard', 'normal', 'emergency']).default('standard'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  impact: z.string().nullable().optional(),
  risk_assessment: z.string().nullable().optional(),
  implementation_plan: z.string().nullable().optional(),
  rollback_plan: z.string().nullable().optional(),
  test_results: z.string().nullable().optional(),
  scheduled_start: z.string().nullable().optional(),
  scheduled_end: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  assets_affected: z.array(z.string().uuid()).default([]),
  services_affected: z.array(z.string()).default([]),
  outage_required: z.boolean().default(false),
  outage_description: z.string().nullable().optional(),
});

const updateChangeSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  description: z.string().optional(),
  change_type: z.enum(['standard', 'normal', 'emergency']).optional(),
  status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'scheduled', 'in_progress', 'completed', 'rejected', 'rolled_back', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  impact: z.string().nullable().optional(),
  risk_assessment: z.string().nullable().optional(),
  implementation_plan: z.string().nullable().optional(),
  rollback_plan: z.string().nullable().optional(),
  test_results: z.string().nullable().optional(),
  scheduled_start: z.string().nullable().optional(),
  scheduled_end: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  assets_affected: z.array(z.string().uuid()).optional(),
  services_affected: z.array(z.string()).optional(),
  outage_required: z.boolean().optional(),
  outage_description: z.string().nullable().optional(),
  cab_notes: z.string().nullable().optional(),
  post_implementation_review: z.string().nullable().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1),
});

const completeSchema = z.object({
  post_implementation_review: z.string().nullable().optional(),
});

const rollbackSchema = z.object({
  reason: z.string().min(1),
});

export default async function changeRoutes(fastify: FastifyInstance) {

  // ─────────────────────────────────────────────────────────
  //  HELPER: log change activity
  // ─────────────────────────────────────────────────────────
  async function logActivity(changeId: string, actorId: string, action: string, oldValue?: string, newValue?: string, comment?: string) {
    await pool.query(
      `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value, comment)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [changeId, actorId, action, oldValue || null, newValue || null, comment || null]
    );
  }

  // ─────────────────────────────────────────────────────────
  //  HELPER: fetch change with joins
  // ─────────────────────────────────────────────────────────
  async function fetchChange(id: string) {
    const result = await pool.query(
      `SELECT c.*,
        u1.name as requested_by_name, u1.email as requested_by_email,
        u2.name as assigned_to_name, u2.email as assigned_to_email, u2.avatar_url as assigned_to_avatar,
        cat.name as category_name, cat.color as category_color,
        ar.status as approval_status, ar.title as approval_title
       FROM changes c
       LEFT JOIN users u1 ON c.requested_by_id = u1.id
       LEFT JOIN users u2 ON c.assigned_to_id = u2.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN approval_requests ar ON c.approval_id = ar.id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  // ─────────────────────────────────────────────────────────
  //  GET /changes — list changes with pagination, search, filters
  // ─────────────────────────────────────────────────────────
  fastify.get('/changes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(25),
      status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'scheduled', 'in_progress', 'completed', 'rejected', 'rolled_back', 'cancelled']).optional(),
      change_type: z.enum(['standard', 'normal', 'emergency']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assigned_to: z.string().uuid().optional(),
      search: z.string().max(200).optional(),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.status) {
      whereClause += ` AND c.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.change_type) {
      whereClause += ` AND c.change_type = $${paramIdx++}`;
      params.push(query.change_type);
    }
    if (query.priority) {
      whereClause += ` AND c.priority = $${paramIdx++}`;
      params.push(query.priority);
    }
    if (query.risk_level) {
      whereClause += ` AND c.risk_level = $${paramIdx++}`;
      params.push(query.risk_level);
    }
    if (query.assigned_to) {
      whereClause += ` AND c.assigned_to_id = $${paramIdx++}`;
      params.push(query.assigned_to);
    }
    if (query.search) {
      whereClause += ` AND (c.title ILIKE $${paramIdx} OR c.description ILIKE $${paramIdx} OR c.number::text ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM changes c ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT c.*,
        u1.name as requested_by_name,
        u2.name as assigned_to_name, u2.avatar_url as assigned_to_avatar,
        cat.name as category_name, cat.color as category_color
       FROM changes c
       LEFT JOIN users u1 ON c.requested_by_id = u1.id
       LEFT JOIN users u2 ON c.assigned_to_id = u2.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       ${whereClause}
       ORDER BY c.created_at DESC
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
  //  GET /changes/calendar — calendar view
  // ─────────────────────────────────────────────────────────
  fastify.get('/changes/calendar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const querySchema = z.object({
      start: z.string(),
      end: z.string(),
    });
    const query = querySchema.parse(request.query);

    const result = await pool.query(
      `SELECT c.id, c.number, c.title, c.status, c.change_type, c.risk_level, c.priority,
              c.scheduled_start, c.scheduled_end, c.assigned_to_id,
              u.name as assigned_to_name
       FROM changes c
       LEFT JOIN users u ON c.assigned_to_id = u.id
       WHERE c.scheduled_start <= $1::timestamptz
         AND c.scheduled_end >= $2::timestamptz
         AND c.status NOT IN ('draft', 'cancelled', 'rejected')
       ORDER BY c.scheduled_start ASC`,
      [query.end, query.start]
    );

    return reply.send({ data: result.rows });
  });

  // ─────────────────────────────────────────────────────────
  //  GET /changes/:id — get change with activity
  // ─────────────────────────────────────────────────────────
  fastify.get('/changes/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params as { id: string };

    const change = await fetchChange(id);
    if (!change) {
      return reply.status(404).send({ error: 'Change not found' });
    }

    // Get activity
    const activity = await pool.query(
      `SELECT ca.*, u.name as actor_name
       FROM change_activity ca
       JOIN users u ON ca.actor_id = u.id
       WHERE ca.change_id = $1
       ORDER BY ca.created_at ASC`,
      [id]
    );

    return reply.send({
      data: {
        ...change,
        activity: activity.rows,
      },
    });
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes — create change
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes', { preHandler: [fastify.requirePermission('create_changes')] }, async (request, reply) => {
    const body = createChangeSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO changes (title, description, change_type, priority, risk_level, impact, risk_assessment,
          implementation_plan, rollback_plan, test_results, scheduled_start, scheduled_end,
          category_id, assigned_to_id, assets_affected, services_affected, outage_required,
          outage_description, requested_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [body.title, body.description, body.change_type, body.priority, body.risk_level,
         body.impact || null, body.risk_assessment || null, body.implementation_plan || null,
         body.rollback_plan || null, body.test_results || null, body.scheduled_start || null,
         body.scheduled_end || null, body.category_id || null, body.assigned_to_id || null,
         body.assets_affected, body.services_affected, body.outage_required,
         body.outage_description || null, request.user.id]
      );

      const rawChange = result.rows[0];

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, new_value)
         VALUES ($1, $2, 'created', $3)`,
        [rawChange.id, request.user.id, rawChange.status]
      );

      await client.query('COMMIT');

      const change = await fetchChange(rawChange.id);

      return reply.status(201).send({ data: change });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  PATCH /changes/:id — update change
  // ─────────────────────────────────────────────────────────
  fastify.patch('/changes/:id', { preHandler: [fastify.requirePermission('manage_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateChangeSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current change
      const current = await client.query('SELECT * FROM changes WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (body.title !== undefined) { updates.push(`title = $${paramIdx++}`); params.push(body.title); }
      if (body.description !== undefined) { updates.push(`description = $${paramIdx++}`); params.push(body.description); }
      if (body.change_type !== undefined) { updates.push(`change_type = $${paramIdx++}`); params.push(body.change_type); }
      if (body.status !== undefined) { updates.push(`status = $${paramIdx++}`); params.push(body.status); }
      if (body.priority !== undefined) { updates.push(`priority = $${paramIdx++}`); params.push(body.priority); }
      if (body.risk_level !== undefined) { updates.push(`risk_level = $${paramIdx++}`); params.push(body.risk_level); }
      if (body.impact !== undefined) { updates.push(`impact = $${paramIdx++}`); params.push(body.impact); }
      if (body.risk_assessment !== undefined) { updates.push(`risk_assessment = $${paramIdx++}`); params.push(body.risk_assessment); }
      if (body.implementation_plan !== undefined) { updates.push(`implementation_plan = $${paramIdx++}`); params.push(body.implementation_plan); }
      if (body.rollback_plan !== undefined) { updates.push(`rollback_plan = $${paramIdx++}`); params.push(body.rollback_plan); }
      if (body.test_results !== undefined) { updates.push(`test_results = $${paramIdx++}`); params.push(body.test_results); }
      if (body.scheduled_start !== undefined) { updates.push(`scheduled_start = $${paramIdx++}`); params.push(body.scheduled_start); }
      if (body.scheduled_end !== undefined) { updates.push(`scheduled_end = $${paramIdx++}`); params.push(body.scheduled_end); }
      if (body.category_id !== undefined) { updates.push(`category_id = $${paramIdx++}`); params.push(body.category_id); }
      if (body.assigned_to_id !== undefined) { updates.push(`assigned_to_id = $${paramIdx++}`); params.push(body.assigned_to_id); }
      if (body.assets_affected !== undefined) { updates.push(`assets_affected = $${paramIdx++}`); params.push(body.assets_affected); }
      if (body.services_affected !== undefined) { updates.push(`services_affected = $${paramIdx++}`); params.push(body.services_affected); }
      if (body.outage_required !== undefined) { updates.push(`outage_required = $${paramIdx++}`); params.push(body.outage_required); }
      if (body.outage_description !== undefined) { updates.push(`outage_description = $${paramIdx++}`); params.push(body.outage_description); }
      if (body.cab_notes !== undefined) { updates.push(`cab_notes = $${paramIdx++}`); params.push(body.cab_notes); }
      if (body.post_implementation_review !== undefined) { updates.push(`post_implementation_review = $${paramIdx++}`); params.push(body.post_implementation_review); }

      // Auto-set timestamps based on status transitions
      if (body.status === 'in_progress') {
        updates.push(`actual_start = NOW()`);
      }
      if (body.status === 'completed' || body.status === 'rolled_back') {
        updates.push(`actual_end = NOW()`);
      }

      if (updates.length > 0) {
        params.push(id);
        await client.query(
          `UPDATE changes SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
          params
        );
      }

      // Auto-create approval request when normal change is submitted
      const newStatus = body.status || change.status;
      if (body.status && body.status !== change.status) {
        const changeType = body.change_type || change.change_type;

        if (newStatus === 'submitted' && changeType === 'normal' && !change.approval_id) {
          // Create approval request for CAB review — first step: admin role approval
          const approvalResult = await client.query(
            `INSERT INTO approval_requests (entity_type, entity_id, title, description, priority, requested_by)
             VALUES ('change', $1, $2, $3, $4, $5)
             RETURNING *`,
            [id, `Change #${change.number}: ${change.title}`,
             body.description || change.description || '', body.priority || change.priority || 'medium', request.user.id]
          );
          const approvalId = approvalResult.rows[0].id;

          // Create single approval step for admin role
          await client.query(
            `INSERT INTO approval_steps (request_id, step_index, approver_role)
             VALUES ($1, 0, 'admin')`,
            [approvalId]
          );

          // Link approval to change
          await client.query(
            `UPDATE changes SET approval_id = $1 WHERE id = $2`,
            [approvalId, id]
          );

          // Log approval creation
          await client.query(
            `INSERT INTO approval_history (request_id, actor_id, action, comment)
             VALUES ($1, $2, 'created', 'Auto-created approval for change submission')`,
            [approvalId, request.user.id]
          );

          // Emit socket notification
          fastify.io.emit('approval:created', { entity_type: 'change', entity_id: id });
        }

        // Auto-create ticket when change is approved
        if (newStatus === 'approved' && !change.ticket_id) {
          const ticketResult = await client.query(
            `INSERT INTO tickets (title, description, ticket_type, status, priority, assigned_to_id, created_by_id)
             VALUES ($1, $2, 'change_task', 'open', $3, $4, $5)
             RETURNING *`,
            [`Implement: ${change.title}`, `Change #${change.number} implementation task.\n\n${body.description || change.description || ''}`,
             body.priority || change.priority || 'medium', body.assigned_to_id || change.assigned_to_id, request.user.id]
          );
          const ticketId = ticketResult.rows[0].id;

          // Create a simple ticket-changes linking via the ticket_id on changes
          await client.query(
            `UPDATE changes SET ticket_id = $1 WHERE id = $2`,
            [ticketId, id]
          );
        }
      }

      // Log status transitions
      if (body.status && body.status !== change.status) {
        await client.query(
          `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value)
           VALUES ($1, $2, 'status_changed', $3, $4)`,
          [id, request.user.id, change.status, body.status]
        );
      }

      // Log other tracked field changes
      const trackedFields = ['title', 'description', 'priority', 'risk_level', 'impact', 'risk_assessment',
        'implementation_plan', 'rollback_plan', 'test_results', 'assigned_to_id', 'category_id'];
      for (const field of trackedFields) {
        const bodyVal = (body as any)[field];
        if (bodyVal !== undefined && bodyVal !== (change as any)[field]) {
          await client.query(
            `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, request.user.id, field, String((change as any)[field] ?? ''), String(bodyVal ?? '')]
          );
        }
      }

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);

      // Emit socket event
      fastify.io.emit('change:updated', { changeId: id });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  DELETE /changes/:id — delete change (draft only)
  // ─────────────────────────────────────────────────────────
  fastify.delete('/changes/:id', { preHandler: [fastify.requirePermission('delete_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const current = await pool.query('SELECT status FROM changes WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ error: 'Change not found' });
    }
    if (current.rows[0].status !== 'draft') {
      return reply.status(400).send({ error: 'Only draft changes can be deleted' });
    }

    await pool.query('DELETE FROM changes WHERE id = $1', [id]);
    return reply.status(204).send();
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/submit — submit for review
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes/:id/submit', { preHandler: [fastify.requirePermission('manage_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM changes WHERE id = $1 FOR UPDATE', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      if (change.status !== 'draft') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot submit a change with status '${change.status}'` });
      }

      // Determine next status based on change type
      let newStatus = 'submitted';
      if (change.change_type === 'standard') {
        // Standard changes are pre-approved — skip to approved
        newStatus = 'approved';
      } else if (change.change_type === 'emergency') {
        // Emergency changes go to under_review for direct admin approval
        newStatus = 'under_review';
      }

      await client.query(
        `UPDATE changes SET status = $1 WHERE id = $2`,
        [newStatus, id]
      );

      // For normal changes, create approval request
      if (change.change_type === 'normal') {
        const approvalResult = await client.query(
          `INSERT INTO approval_requests (entity_type, entity_id, title, description, priority, requested_by)
           VALUES ('change', $1, $2, $3, $4, $5)
           RETURNING *`,
          [id, `Change #${change.number}: ${change.title}`, change.description || '', change.priority, request.user.id]
        );
        const approvalId = approvalResult.rows[0].id;

        await client.query(
          `INSERT INTO approval_steps (request_id, step_index, approver_role)
           VALUES ($1, 0, 'admin')`,
          [approvalId]
        );

        await client.query(
          `UPDATE changes SET approval_id = $1 WHERE id = $2`,
          [approvalId, id]
        );

        await client.query(
          `INSERT INTO approval_history (request_id, actor_id, action, comment)
           VALUES ($1, $2, 'created', 'Approval created for change submission')`,
          [approvalId, request.user.id]
        );
      }

      // For standard changes that auto-approve, create implementation ticket
      if (change.change_type === 'standard') {
        const ticketResult = await client.query(
          `INSERT INTO tickets (title, description, ticket_type, status, priority, assigned_to_id, created_by_id)
           VALUES ($1, $2, 'change_task', 'open', $3, $4, $5)
           RETURNING *`,
          [`Implement: ${change.title}`, `Change #${change.number} implementation task.\n\n${change.description || ''}`,
           change.priority, change.assigned_to_id, request.user.id]
        );
        await client.query(
          `UPDATE changes SET ticket_id = $1 WHERE id = $2`,
          [ticketResult.rows[0].id, id]
        );
      }

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value)
         VALUES ($1, $2, 'submitted', $3, $4)`,
        [id, request.user.id, change.status, newStatus]
      );

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);
      fastify.io.emit('change:updated', { changeId: id, action: 'submitted' });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/approve — approve change
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes/:id/approve', { preHandler: [fastify.requirePermission('approve_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM changes WHERE id = $1 FOR UPDATE', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      if (!['submitted', 'under_review'].includes(change.status)) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot approve a change with status '${change.status}'` });
      }

      await client.query(
        `UPDATE changes SET status = 'approved' WHERE id = $1`,
        [id]
      );

      // Create implementation ticket
      if (!change.ticket_id) {
        const ticketResult = await client.query(
          `INSERT INTO tickets (title, description, ticket_type, status, priority, assigned_to_id, created_by_id)
           VALUES ($1, $2, 'change_task', 'open', $3, $4, $5)
           RETURNING *`,
          [`Implement: ${change.title}`, `Change #${change.number} implementation task.\n\n${change.description || ''}`,
           change.priority, change.assigned_to_id, request.user.id]
        );
        await client.query(
          `UPDATE changes SET ticket_id = $1 WHERE id = $2`,
          [ticketResult.rows[0].id, id]
        );
      }

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value)
         VALUES ($1, $2, 'approved', $3, 'approved')`,
        [id, request.user.id, change.status]
      );

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);
      fastify.io.emit('change:updated', { changeId: id, action: 'approved' });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/reject — reject change
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes/:id/reject', { preHandler: [fastify.requirePermission('approve_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = rejectSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM changes WHERE id = $1 FOR UPDATE', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      if (!['submitted', 'under_review'].includes(change.status)) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot reject a change with status '${change.status}'` });
      }

      await client.query(
        `UPDATE changes SET status = 'rejected' WHERE id = $1`,
        [id]
      );

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value, comment)
         VALUES ($1, $2, 'rejected', $3, 'rejected', $4)`,
        [id, request.user.id, change.status, body.reason]
      );

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);
      fastify.io.emit('change:updated', { changeId: id, action: 'rejected' });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/start — start implementation
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes/:id/start', { preHandler: [fastify.requirePermission('manage_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM changes WHERE id = $1 FOR UPDATE', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      if (change.status !== 'approved' && change.status !== 'scheduled') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot start a change with status '${change.status}'` });
      }

      await client.query(
        `UPDATE changes SET status = 'in_progress', actual_start = NOW() WHERE id = $1`,
        [id]
      );

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value)
         VALUES ($1, $2, 'implementation_started', $3, 'in_progress')`,
        [id, request.user.id, change.status]
      );

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);
      fastify.io.emit('change:updated', { changeId: id, action: 'started' });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/complete — mark completed
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes/:id/complete', { preHandler: [fastify.requirePermission('manage_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = completeSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM changes WHERE id = $1 FOR UPDATE', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      if (change.status !== 'in_progress') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot complete a change with status '${change.status}'` });
      }

      await client.query(
        `UPDATE changes SET status = 'completed', actual_end = NOW(), post_implementation_review = COALESCE($1, post_implementation_review) WHERE id = $2`,
        [body.post_implementation_review || null, id]
      );

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value)
         VALUES ($1, $2, 'completed', $3, 'completed')`,
        [id, request.user.id, change.status]
      );

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);
      fastify.io.emit('change:updated', { changeId: id, action: 'completed' });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/rollback — mark rolled back
  // ─────────────────────────────────────────────────────────
  fastify.post('/changes/:id/rollback', { preHandler: [fastify.requirePermission('manage_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = rollbackSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT * FROM changes WHERE id = $1 FOR UPDATE', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Change not found' });
      }

      const change = current.rows[0];

      if (change.status !== 'in_progress') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot rollback a change with status '${change.status}'` });
      }

      await client.query(
        `UPDATE changes SET status = 'rolled_back', actual_end = NOW() WHERE id = $1`,
        [id]
      );

      // Log activity
      await client.query(
        `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value, comment)
         VALUES ($1, $2, 'rolled_back', $3, 'rolled_back', $4)`,
        [id, request.user.id, change.status, body.reason]
      );

      await client.query('COMMIT');

      const updatedChange = await fetchChange(id);
      fastify.io.emit('change:updated', { changeId: id, action: 'rolled_back' });

      return reply.send({ data: updatedChange });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────
  //  POST /changes/:id/activity — add activity entry
  // ─────────────────────────────────────────────────────────
  const createActivitySchema = z.object({
    action: z.string().min(1).max(100),
    old_value: z.string().nullable().optional(),
    new_value: z.string().nullable().optional(),
    comment: z.string().nullable().optional(),
  });

  fastify.post('/changes/:id/activity', { preHandler: [fastify.requirePermission('manage_changes')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createActivitySchema.parse(request.body);

    const changeCheck = await pool.query('SELECT id FROM changes WHERE id = $1', [id]);
    if (changeCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Change not found' });
    }

    const result = await pool.query(
      `INSERT INTO change_activity (change_id, actor_id, action, old_value, new_value, comment)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, request.user.id, body.action, body.old_value || null, body.new_value || null, body.comment || null]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });
}
