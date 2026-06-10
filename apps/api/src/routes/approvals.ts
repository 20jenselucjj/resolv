import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function approvalRoutes(fastify: FastifyInstance) {

  // ─── GET /approvals — List approval requests ────────────────────────────
  fastify.get('/approvals', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(25),
      status: z.enum(['pending', 'approved', 'denied', 'cancelled', 'escalated']).optional(),
      entity_type: z.string().max(100).optional(),
      entity_id: z.string().uuid().optional(),
      requested_by: z.string().uuid().optional(),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Row-level auth: agents/admins see all; users see only their own or assigned
    if (request.user.role === 'user') {
      whereClause += ` AND (ar.requested_by = $${paramIdx} OR EXISTS (
        SELECT 1 FROM approval_steps aps
        WHERE aps.request_id = ar.id
          AND (aps.approver_id = $${paramIdx} OR aps.approver_role = $${paramIdx + 1}::text)
          AND aps.status = 'pending'
      ))`;
      params.push(request.user.id, request.user.role);
      paramIdx += 2;
    }

    if (query.status) {
      whereClause += ` AND ar.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.entity_type) {
      whereClause += ` AND ar.entity_type = $${paramIdx++}`;
      params.push(query.entity_type);
    }
    if (query.entity_id) {
      whereClause += ` AND ar.entity_id = $${paramIdx++}`;
      params.push(query.entity_id);
    }
    if (query.requested_by) {
      whereClause += ` AND ar.requested_by = $${paramIdx++}`;
      params.push(query.requested_by);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM approval_requests ar ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT ar.*, u.name as requested_by_name, u.email as requested_by_email,
        (SELECT json_build_object(
          'id', aps.id, 'step_index', aps.step_index,
          'approver_id', aps.approver_id, 'approver_role', aps.approver_role,
          'approver_type', aps.approver_type,
          'status', aps.status, 'comment', aps.comment, 'decided_at', aps.decided_at,
          'approver_name', approver.name
        ) FROM approval_steps aps
        LEFT JOIN users approver ON aps.approver_id = approver.id
        WHERE aps.request_id = ar.id AND aps.status = 'pending'
        ORDER BY aps.step_index ASC LIMIT 1) as current_step
       FROM approval_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       ${whereClause}
       ORDER BY ar.created_at DESC
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

  // ─── GET /approvals/my-pending — Pending approvals for current user ────
  fastify.get('/approvals/my-pending', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(
      `SELECT aps.*, ar.id as request_id, ar.entity_type, ar.entity_id, ar.title, ar.description,
              ar.status as request_status, ar.priority, ar.due_date, ar.created_at as request_created_at,
              ar.requested_by, u.name as requested_by_name,
              CASE
                WHEN aps.approver_type = 'manager_of_requester' THEN 'Manager'
                ELSE COALESCE(approver.name, 'Role: ' || aps.approver_role)
              END as approver_name
       FROM approval_steps aps
       JOIN approval_requests ar ON aps.request_id = ar.id
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users approver ON aps.approver_id = approver.id
       WHERE aps.status = 'pending'
         AND ar.status = 'pending'
         AND (
           aps.approver_id = $1
           OR aps.approver_role = $2
           OR (aps.approver_type = 'manager_of_requester' AND EXISTS (
             SELECT 1 FROM users WHERE id = ar.requested_by AND manager_id = $1
           ))
         )
       ORDER BY ar.priority ASC, ar.due_date ASC NULLS LAST, ar.created_at ASC`,
      [request.user.id, request.user.role]
    );

    return reply.send({ data: result.rows });
  });

  // ─── GET /approvals/:id — Single approval with steps and history ──────
  fastify.get('/approvals/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const approvalResult = await pool.query(
      `SELECT ar.*, u.name as requested_by_name, u.email as requested_by_email
       FROM approval_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       WHERE ar.id = $1`,
      [id]
    );

    if (approvalResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Approval request not found' });
    }

    const approval = approvalResult.rows[0];

    // Row-level auth
    if (request.user.role === 'user') {
      const isApprover = await pool.query(
        `SELECT id FROM approval_steps
         WHERE request_id = $1 AND (approver_id = $2 OR approver_role = $3)
         LIMIT 1`,
        [id, request.user.id, request.user.role]
      );
      if (approval.requested_by !== request.user.id && isApprover.rows.length === 0) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    }

    // Get steps
    const stepsResult = await pool.query(
      `SELECT aps.*, u.name as approver_name, u.email as approver_email, u.avatar_url as approver_avatar
       FROM approval_steps aps
       LEFT JOIN users u ON aps.approver_id = u.id
       WHERE aps.request_id = $1
       ORDER BY aps.step_index ASC`,
      [id]
    );

    // For manager_of_requester steps, resolve the manager's name from the requester
    const approver = approvalResult.rows[0];
    for (const step of stepsResult.rows) {
      if (step.approver_type === 'manager_of_requester') {
        const mgrResult = await pool.query(
          `SELECT u.name, u.email FROM users u WHERE u.id = (SELECT manager_id FROM users WHERE id = $1)`,
          [approver.requested_by]
        );
        if (mgrResult.rows.length > 0) {
          step.approver_name = mgrResult.rows[0].name;
          step.approver_email = mgrResult.rows[0].email;
        } else {
          step.approver_name = 'Manager (not assigned)';
        }
      }
    }

    // Get history
    const historyResult = await pool.query(
      `SELECT ah.*, u.name as actor_name
       FROM approval_history ah
       LEFT JOIN users u ON ah.actor_id = u.id
       WHERE ah.request_id = $1
       ORDER BY ah.created_at ASC`,
      [id]
    );

    return reply.send({
      data: {
        ...approval,
        steps: stepsResult.rows,
        history: historyResult.rows,
      },
    });
  });

  // ─── POST /approvals — Create approval request ───────────────────────
  const stepInputSchema = z.object({
    approver_id: z.string().uuid().optional(),
    approver_role: z.string().max(50).optional(),
    approver_type: z.enum(['role', 'manager_of_requester', 'user']).optional().default('role'),
  });

  const createApprovalSchema = z.object({
    entity_type: z.string().min(1).max(100),
    entity_id: z.string().uuid(),
    title: z.string().min(1).max(500),
    description: z.string().optional().default(''),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    due_date: z.string().optional(),
    steps: z.array(stepInputSchema).min(1, 'At least one approval step is required'),
  });

  fastify.post('/approvals', { preHandler: [fastify.requirePermission('create_approvals')] }, async (request, reply) => {
    const body = createApprovalSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create the approval request
      const requestResult = await client.query(
        `INSERT INTO approval_requests (entity_type, entity_id, title, description, priority, due_date, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [body.entity_type, body.entity_id, body.title, body.description, body.priority, body.due_date || null, request.user.id]
      );
      const approvalRequest = requestResult.rows[0];

      // Create approval steps
      for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i];
        const approverType = step.approver_type || 'role';
        await client.query(
          `INSERT INTO approval_steps (request_id, step_index, approver_id, approver_role, approver_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [approvalRequest.id, i, step.approver_id || null, step.approver_role || null, approverType]
        );
      }

      // Log creation
      await client.query(
        `INSERT INTO approval_history (request_id, actor_id, action, comment)
         VALUES ($1, $2, 'created', $3)`,
        [approvalRequest.id, request.user.id, `Approval request created with ${body.steps.length} step(s)`]
      );

      await client.query('COMMIT');

      // Fetch full data with steps
      const fullResult = await pool.query(
        `SELECT ar.*, u.name as requested_by_name, u.email as requested_by_email
         FROM approval_requests ar
         LEFT JOIN users u ON ar.requested_by = u.id
         WHERE ar.id = $1`,
        [approvalRequest.id]
      );

      const stepsResult = await pool.query(
        `SELECT aps.*, u.name as approver_name
         FROM approval_steps aps
         LEFT JOIN users u ON aps.approver_id = u.id
         WHERE aps.request_id = $1
         ORDER BY aps.step_index ASC`,
        [approvalRequest.id]
      );

      const response = {
        ...fullResult.rows[0],
        steps: stepsResult.rows,
        history: [],
      };

      // Emit socket event for real-time updates
      fastify.io.emit('approval:created', { approval: response });

      // Notify first-step approvers via socket
      if (stepsResult.rows.length > 0) {
        const firstStep = stepsResult.rows[0];
        if (firstStep.approver_id) {
          fastify.io.to(`user:${firstStep.approver_id}`).emit('approval:updated', {
            approvalId: approvalRequest.id,
            action: 'approval_requested',
          });
        }
      }

      return reply.status(201).send({ data: response });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─── POST /approvals/:id/approve — Approve current step ────────────
  const approveDenySchema = z.object({
    comment: z.string().optional().default(''),
  });

  fastify.post('/approvals/:id/approve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = approveDenySchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current request
      const requestResult = await client.query(
        'SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Approval request not found' });
      }

      const approvalRequest = requestResult.rows[0];

      if (approvalRequest.status !== 'pending') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Approval request is already ${approvalRequest.status}` });
      }

      // Find the current pending step (first pending by step_index)
      const stepResult = await client.query(
        `SELECT * FROM approval_steps
         WHERE request_id = $1 AND status = 'pending'
         ORDER BY step_index ASC LIMIT 1`,
        [id]
      );

      if (stepResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'No pending step found' });
      }

      const currentStep = stepResult.rows[0];

      // Verify the current user is the approver or is admin
      const isAdmin = request.user.role === 'admin';
      const isApproverById = currentStep.approver_id === request.user.id;
      const isApproverByRole = currentStep.approver_role && currentStep.approver_role === request.user.role;

      // Check manager_of_requester: current user must be the manager of the requester
      let isManagerOfRequester = false;
      if (currentStep.approver_type === 'manager_of_requester') {
        const mgrCheck = await client.query(
          `SELECT 1 FROM users WHERE id = $1 AND manager_id = $2`,
          [request.user.id, approvalRequest.requested_by]
        );
        isManagerOfRequester = mgrCheck.rows.length > 0;
      }

      if (!isAdmin && !isApproverById && !isApproverByRole && !isManagerOfRequester) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'You are not the approver for the current step' });
      }

      // Mark step as approved
      await client.query(
        `UPDATE approval_steps SET status = 'approved', comment = $1, decided_at = NOW()
         WHERE id = $2`,
        [body.comment || null, currentStep.id]
      );

      // Log in approval_history
      await client.query(
        `INSERT INTO approval_history (request_id, step_id, actor_id, action, comment)
         VALUES ($1, $2, $3, 'approved', $4)`,
        [id, currentStep.id, request.user.id, body.comment || null]
      );

      // Check if there is a next step
      const nextStepResult = await client.query(
        `SELECT id FROM approval_steps
         WHERE request_id = $1 AND status = 'pending' AND step_index > $2
         ORDER BY step_index ASC LIMIT 1`,
        [id, currentStep.step_index]
      );

      if (nextStepResult.rows.length === 0) {
        // This was the last step — mark request as approved
        await client.query(
          `UPDATE approval_requests SET status = 'approved' WHERE id = $1`,
          [id]
        );

        await client.query(
          `INSERT INTO approval_history (request_id, actor_id, action, comment)
           VALUES ($1, $2, 'completed', 'All steps approved')`,
          [id, request.user.id]
        );
      }

      await client.query('COMMIT');

      // Fetch updated approval
      const updatedApproval = await fetchApproval(id);

      // Emit socket events
      fastify.io.emit('approval:updated', {
        approvalId: id,
        action: 'step_approved',
        stepId: currentStep.id,
        approval: updatedApproval,
      });

      // Notify the requestor
      fastify.io.to(`user:${approvalRequest.requested_by}`).emit('approval:updated', {
        approvalId: id,
        action: 'step_approved',
      });

      // If next step exists, notify the next approver
      if (nextStepResult.rows.length > 0) {
        const nextStepData = await pool.query(
          'SELECT * FROM approval_steps WHERE id = $1',
          [nextStepResult.rows[0].id]
        );
        const nextStep = nextStepData.rows[0];
        if (nextStep.approver_id) {
          fastify.io.to(`user:${nextStep.approver_id}`).emit('approval:updated', {
            approvalId: id,
            action: 'approval_requested',
          });
        }
      }

      return reply.send({ data: updatedApproval });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─── POST /approvals/:id/deny — Deny approval ────────────────────────
  const denySchema = z.object({
    comment: z.string().min(1, 'Comment is required for denial'),
  });

  fastify.post('/approvals/:id/deny', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = denySchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current request
      const requestResult = await client.query(
        'SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Approval request not found' });
      }

      const approvalRequest = requestResult.rows[0];

      if (approvalRequest.status !== 'pending') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Approval request is already ${approvalRequest.status}` });
      }

      // Find the current pending step
      const stepResult = await client.query(
        `SELECT * FROM approval_steps
         WHERE request_id = $1 AND status = 'pending'
         ORDER BY step_index ASC LIMIT 1`,
        [id]
      );

      if (stepResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'No pending step found' });
      }

      const currentStep = stepResult.rows[0];

      // Verify the current user is the approver or is admin
      const isAdmin = request.user.role === 'admin';
      const isApproverById = currentStep.approver_id === request.user.id;
      const isApproverByRole = currentStep.approver_role && currentStep.approver_role === request.user.role;

      // Check manager_of_requester: current user must be the manager of the requester
      let isManagerOfRequester = false;
      if (currentStep.approver_type === 'manager_of_requester') {
        const mgrCheck = await client.query(
          `SELECT 1 FROM users WHERE id = $1 AND manager_id = $2`,
          [request.user.id, approvalRequest.requested_by]
        );
        isManagerOfRequester = mgrCheck.rows.length > 0;
      }

      if (!isAdmin && !isApproverById && !isApproverByRole && !isManagerOfRequester) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'You are not the approver for the current step' });
      }

      // Mark step as denied
      await client.query(
        `UPDATE approval_steps SET status = 'denied', comment = $1, decided_at = NOW()
         WHERE id = $2`,
        [body.comment, currentStep.id]
      );

      // Mark entire request as denied
      await client.query(
        `UPDATE approval_requests SET status = 'denied' WHERE id = $1`,
        [id]
      );

      // Log in approval_history
      await client.query(
        `INSERT INTO approval_history (request_id, step_id, actor_id, action, comment)
         VALUES ($1, $2, $3, 'denied', $4)`,
        [id, currentStep.id, request.user.id, body.comment]
      );

      await client.query('COMMIT');

      const updatedApproval = await fetchApproval(id);

      // Emit socket events
      fastify.io.emit('approval:updated', {
        approvalId: id,
        action: 'step_denied',
        stepId: currentStep.id,
        approval: updatedApproval,
      });

      fastify.io.to(`user:${approvalRequest.requested_by}`).emit('approval:updated', {
        approvalId: id,
        action: 'step_denied',
      });

      return reply.send({ data: updatedApproval });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─── POST /approvals/:id/cancel — Cancel approval request ──────────
  fastify.post('/approvals/:id/cancel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const requestResult = await client.query(
        'SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Approval request not found' });
      }

      const approvalRequest = requestResult.rows[0];

      // Only admin or the requester can cancel
      if (request.user.role !== 'admin' && approvalRequest.requested_by !== request.user.id) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'Only the requester or an admin can cancel this request' });
      }

      if (approvalRequest.status !== 'pending') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: `Cannot cancel: request is already ${approvalRequest.status}` });
      }

      // Cancel all pending steps
      await client.query(
        `UPDATE approval_steps SET status = 'skipped', comment = 'Request cancelled'
         WHERE request_id = $1 AND status = 'pending'`,
        [id]
      );

      // Mark request as cancelled
      await client.query(
        `UPDATE approval_requests SET status = 'cancelled' WHERE id = $1`,
        [id]
      );

      // Log
      await client.query(
        `INSERT INTO approval_history (request_id, actor_id, action, comment)
         VALUES ($1, $2, 'cancelled', 'Request cancelled by ${request.user.name}')`,
        [id, request.user.id]
      );

      await client.query('COMMIT');

      const updatedApproval = await fetchApproval(id);

      fastify.io.emit('approval:updated', {
        approvalId: id,
        action: 'cancelled',
        approval: updatedApproval,
      });

      return reply.send({ data: updatedApproval });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─── Helper: fetch full approval data ─────────────────────────────────
  async function fetchApproval(id: string) {
    const approvalResult = await pool.query(
      `SELECT ar.*, u.name as requested_by_name, u.email as requested_by_email
       FROM approval_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       WHERE ar.id = $1`,
      [id]
    );
    if (approvalResult.rows.length === 0) return null;

    const stepsResult = await pool.query(
      `SELECT aps.*, u.name as approver_name, u.email as approver_email, u.avatar_url as approver_avatar
       FROM approval_steps aps
       LEFT JOIN users u ON aps.approver_id = u.id
       WHERE aps.request_id = $1
       ORDER BY aps.step_index ASC`,
      [id]
    );

    // For manager_of_requester steps, resolve the manager's name
    for (const step of stepsResult.rows) {
      if (step.approver_type === 'manager_of_requester') {
        const mgrResult = await pool.query(
          `SELECT u.name, u.email FROM users u WHERE u.id = (SELECT manager_id FROM users WHERE id = $1)`,
          [approvalResult.rows[0].requested_by]
        );
        if (mgrResult.rows.length > 0) {
          step.approver_name = mgrResult.rows[0].name;
          step.approver_email = mgrResult.rows[0].email;
        } else {
          step.approver_name = 'Manager (not assigned)';
        }
      }
    }

    const historyResult = await pool.query(
      `SELECT ah.*, u.name as actor_name
       FROM approval_history ah
       LEFT JOIN users u ON ah.actor_id = u.id
       WHERE ah.request_id = $1
       ORDER BY ah.created_at ASC`,
      [id]
    );

    return {
      ...approvalResult.rows[0],
      steps: stepsResult.rows,
      history: historyResult.rows,
    };
  }
}
