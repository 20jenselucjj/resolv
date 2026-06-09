import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { executeWorkflow } from '../services/workflow-engine';

const TRIGGER_TYPES = [
  'ticket_created', 'ticket_updated', 'status_changed', 'ticket_assigned',
  'comment_added', 'ticket_resolved', 'ticket_closed', 'scheduled', 'manual',
] as const;

const STEP_TYPES = [
  'set_field', 'send_notification', 'add_comment', 'set_status', 'assign_to',
  'create_ticket', 'delay', 'condition', 'send_email',
] as const;

// ─── Schema data ─────────────────────────────────────────────────────────────

const schemaData = {
  triggers: [
    { value: 'ticket_created', label: 'Ticket Created', description: 'When a new ticket is submitted by any channel' },
    { value: 'ticket_updated', label: 'Ticket Updated', description: 'When any field on a ticket is modified' },
    { value: 'status_changed', label: 'Status Changed', description: 'When the ticket status transitions to a new value' },
    { value: 'ticket_assigned', label: 'Ticket Assigned', description: 'When a user or group is assigned to the ticket' },
    { value: 'comment_added', label: 'Comment Added', description: 'When a new comment (internal or public) is added' },
    { value: 'ticket_resolved', label: 'Ticket Resolved', description: 'When the ticket status changes to resolved' },
    { value: 'ticket_closed', label: 'Ticket Closed', description: 'When the ticket status changes to closed' },
    { value: 'scheduled', label: 'Scheduled', description: 'Runs on a predefined schedule (cron)' },
    { value: 'manual', label: 'Manual', description: 'Triggered manually by an admin or agent' },
  ],
  condition_fields: [
    { value: 'status', label: 'Status', type: 'select', options: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
    { value: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
    { value: 'title', label: 'Title', type: 'text' },
    { value: 'description', label: 'Description', type: 'text' },
    { value: 'category', label: 'Category', type: 'text' },
    { value: 'ticket_type', label: 'Ticket Type', type: 'select', options: ['incident', 'service_request', 'problem', 'change'] },
    { value: 'assigned_to_id', label: 'Assigned To', type: 'text' },
    { value: 'created_by_id', label: 'Created By', type: 'text' },
  ],
  condition_operators: [
    { value: 'is', label: 'Is' },
    { value: 'is_not', label: 'Is Not' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  step_types: [
    {
      value: 'set_field', label: 'Set Field', icon: 'edit',
      config_fields: [
        { key: 'field', label: 'Field Name', type: 'select', options: ['title', 'description', 'priority', 'assigned_to_id', 'category_id', 'ticket_type'] },
        { key: 'value', label: 'Value', type: 'text', hint: 'Use {{ticket.field}} for variable interpolation' },
      ],
    },
    {
      value: 'send_notification', label: 'Send Notification', icon: 'bell',
      config_fields: [
        { key: 'recipients', label: 'Recipients', type: 'multi_select', options: ['assignee', 'requestor', 'group', 'all_agents'] },
        { key: 'template', label: 'Notification Template', type: 'text', hint: 'e.g. ticket_assigned, ticket_updated' },
      ],
    },
    {
      value: 'add_comment', label: 'Add Comment', icon: 'message-square',
      config_fields: [
        { key: 'body', label: 'Comment Body', type: 'textarea', hint: 'Use {{ticket.field}} for variable interpolation' },
        { key: 'is_internal', label: 'Internal Note', type: 'boolean' },
      ],
    },
    {
      value: 'set_status', label: 'Set Status', icon: 'check-circle',
      config_fields: [
        { key: 'status', label: 'Status', type: 'select', options: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
      ],
    },
    {
      value: 'assign_to', label: 'Assign To', icon: 'user-plus',
      config_fields: [
        { key: 'user_id', label: 'User ID', type: 'text', hint: 'UUID of the user to assign' },
        { key: 'group_id', label: 'Group ID', type: 'text', hint: 'UUID of the group to assign (optional)' },
      ],
    },
    {
      value: 'create_ticket', label: 'Create Ticket', icon: 'plus-circle',
      config_fields: [
        { key: 'title', label: 'Title', type: 'text', hint: 'Use {{ticket.field}} for variable interpolation' },
        { key: 'ticket_type', label: 'Type', type: 'select', options: ['incident', 'service_request', 'problem', 'change'] },
      ],
    },
    {
      value: 'delay', label: 'Delay', icon: 'clock',
      config_fields: [
        { key: 'minutes', label: 'Delay (minutes)', type: 'number', hint: 'Wait time before continuing to next step' },
      ],
    },
    {
      value: 'condition', label: 'Condition Branch', icon: 'git-branch',
      config_fields: [
        { key: 'conditions', label: 'Conditions', type: 'conditions', hint: 'Branching conditions' },
      ],
    },
    {
      value: 'send_email', label: 'Send Email', icon: 'mail',
      config_fields: [
        { key: 'to', label: 'Recipient(s)', type: 'text', hint: 'email@example.com or comma-separated' },
        { key: 'subject', label: 'Subject', type: 'text', hint: 'Use {{ticket.field}} for variable interpolation' },
        { key: 'body', label: 'Email Body', type: 'textarea', hint: 'Use {{ticket.field}} for variable interpolation' },
      ],
    },
  ],
};

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function workflowDesignerRoutes(fastify: FastifyInstance) {

  // ─── Schema endpoint (no auth, but we'll still check admin for consistency) ──

  fastify.get('/workflows/visual/schema', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    return reply.send({ data: schemaData });
  });

  // ─── List workflows ────────────────────────────────────────────────────────

  fastify.get('/workflows/visual', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20')));
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.trigger_type) {
      whereClause += ` AND w.trigger_type = $${paramIdx++}`;
      params.push(query.trigger_type);
    }
    if (query.is_active !== undefined) {
      whereClause += ` AND w.is_active = $${paramIdx++}`;
      params.push(query.is_active === 'true');
    }
    if (query.search) {
      whereClause += ` AND w.name ILIKE $${paramIdx++}`;
      params.push(`%${query.search}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM visual_workflows w ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT w.id, w.name, w.description, w.trigger_type, w.is_active,
              JSONB_ARRAY_LENGTH(w.steps) as step_count, w.execution_order,
              w.run_count, w.last_run_at, w.last_error, w.created_by,
              w.created_at, w.updated_at
       FROM visual_workflows w
       ${whereClause}
       ORDER BY w.execution_order ASC, w.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  // ─── Get single workflow ───────────────────────────────────────────────────

  fastify.get('/workflows/visual/:id', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT * FROM visual_workflows WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }
    return reply.send({ data: result.rows[0] });
  });

  // ─── Create workflow ───────────────────────────────────────────────────────

  const createSchema = z.object({
    name: z.string().min(1).max(300),
    description: z.string().optional().nullable().default(''),
    trigger_type: z.enum(TRIGGER_TYPES),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.string().optional().default(''),
    })).optional().default([]),
    steps: z.array(z.object({
      id: z.string(),
      type: z.enum(STEP_TYPES),
      config: z.record(z.any()).optional().default({}),
    })).optional().default([]),
    execution_order: z.number().int().optional().default(0),
  });

  fastify.post('/workflows/visual', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const body = createSchema.parse(request.body);

    const result = await pool.query(
      `INSERT INTO visual_workflows (name, description, trigger_type, conditions, steps, execution_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        body.name,
        body.description || '',
        body.trigger_type,
        JSON.stringify(body.conditions),
        JSON.stringify(body.steps),
        body.execution_order,
        request.user.id,
      ]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'create_visual_workflow', 'visual_workflows', result.rows[0].id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── Update workflow ───────────────────────────────────────────────────────

  const updateSchema = z.object({
    name: z.string().min(1).max(300).optional(),
    description: z.string().optional().nullable(),
    trigger_type: z.enum(TRIGGER_TYPES).optional(),
    is_active: z.boolean().optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.string().optional().default(''),
    })).optional(),
    steps: z.array(z.object({
      id: z.string(),
      type: z.enum(STEP_TYPES),
      config: z.record(z.any()).optional().default({}),
    })).optional(),
    execution_order: z.number().int().optional(),
  });

  fastify.patch('/workflows/visual/:id', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);

    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return reply.send({ data: null });

    // Serialize JSONB fields
    const serialized = fields.map(([k, v]) => {
      if (k === 'conditions' || k === 'steps') return [k, JSON.stringify(v)];
      return [k, v];
    });

    const setClauses = serialized.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = serialized.map(([, v]) => v);

    const result = await pool.query(
      `UPDATE visual_workflows SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_visual_workflow', 'visual_workflows', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // ─── Delete workflow ──────────────────────────────────────────────────────

  fastify.delete('/workflows/visual/:id', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query('DELETE FROM visual_workflows WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_visual_workflow', 'visual_workflows', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

  // ─── Duplicate workflow ───────────────────────────────────────────────────

  fastify.post('/workflows/visual/:id/duplicate', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const source = await pool.query('SELECT * FROM visual_workflows WHERE id = $1', [id]);
    if (source.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const w = source.rows[0];
    const result = await pool.query(
      `INSERT INTO visual_workflows (name, description, trigger_type, is_active, conditions, steps, execution_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        `${w.name} (Copy)`,
        w.description,
        w.trigger_type,
        false,
        w.conditions,
        w.steps,
        w.execution_order + 1,
        request.user.id,
      ]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ─── Toggle active/inactive ────────────────────────────────────────────────

  fastify.patch('/workflows/visual/:id/toggle', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `UPDATE visual_workflows SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, name, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return reply.send({ data: result.rows[0] });
  });

  // ─── Test run workflow ─────────────────────────────────────────────────────

  fastify.post('/workflows/visual/:id/test', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const body = z.object({
      sample_ticket: z.record(z.any()).optional().default({}),
    }).parse(request.body);

    const workflowResult = await pool.query('SELECT * FROM visual_workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];
    const result = await executeWorkflow(workflow, {
      ticketData: body.sample_ticket,
      actor: { id: request.user.id, name: request.user.name, email: '' },
    }, true);

    return reply.send({ data: result });
  });

  // ─── Get execution history ────────────────────────────────────────────────

  fastify.get('/workflows/visual/:id/executions', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20')));
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE e.workflow_id = $1';
    const params: any[] = [id];
    let paramIdx = 2;

    if (query.status) {
      whereClause += ` AND e.status = $${paramIdx++}`;
      params.push(query.status);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM workflow_executions e ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT e.id, e.workflow_id, e.trigger_type, e.status,
              JSONB_ARRAY_LENGTH(e.steps_executed) as steps_count,
              e.error_message, e.duration_ms, e.started_at, e.completed_at
       FROM workflow_executions e
       ${whereClause}
       ORDER BY e.started_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  // ─── Get single execution detail ──────────────────────────────────────────

  fastify.get('/workflows/visual/:id/executions/:execId', { preHandler: [fastify.requirePermission('manage_workflows')] }, async (request, reply) => {
    const { id, execId } = request.params as { id: string; execId: string };

    const result = await pool.query(
      `SELECT * FROM workflow_executions WHERE id = $1 AND workflow_id = $2`,
      [execId, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Execution not found' });
    }

    return reply.send({ data: result.rows[0] });
  });
}

// Engine functions are now exported from ../services/workflow-engine
