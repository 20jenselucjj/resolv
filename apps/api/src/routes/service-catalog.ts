import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

const ITEM_TYPES = ['incident', 'service_request', 'problem', 'change'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const FULFILLMENT_TYPES = ['ticket', 'approval', 'automated'] as const;

// ─── Category Schemas ──────────────────────────────────────────────────────
const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  icon: z.string().max(50).optional().default(''),
  sort_order: z.number().int().default(0),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

// ─── Item Schemas ──────────────────────────────────────────────────────────
const customFieldDefSchema = z.object({
  name: z.string().min(1).max(200),
  field_key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Must be lowercase alphanumeric with underscores'),
  type: z.enum(['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'textarea', 'url']),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  placeholder: z.string().optional().default(''),
});

const createItemSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional().default(''),
  short_description: z.string().max(500).optional().default(''),
  category_id: z.string().uuid().optional().nullable(),
  icon: z.string().max(50).optional().default(''),
  image_url: z.string().optional().nullable(),
  fulfillment_type: z.enum(FULFILLMENT_TYPES).default('ticket'),
  approval_required: z.boolean().default(false),
  approval_role: z.string().max(50).optional().default('manager'),
  priority: z.enum(PRIORITIES).default('medium'),
  ticket_type: z.enum(ITEM_TYPES).default('service_request'),
  custom_fields: z.array(customFieldDefSchema).default([]),
  sort_order: z.number().int().default(0),
});

const updateItemSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  short_description: z.string().max(500).optional(),
  category_id: z.string().uuid().nullable().optional(),
  icon: z.string().max(50).optional(),
  image_url: z.string().nullable().optional(),
  fulfillment_type: z.enum(FULFILLMENT_TYPES).optional(),
  approval_required: z.boolean().optional(),
  approval_role: z.string().max(50).optional(),
  priority: z.enum(PRIORITIES).optional(),
  ticket_type: z.enum(ITEM_TYPES).optional(),
  custom_fields: z.array(customFieldDefSchema).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// ─── Service Request Schemas ───────────────────────────────────────────────
const submitRequestSchema = z.object({
  catalog_item_id: z.string().uuid(),
  answers: z.record(z.any()).default({}),
});

export default async function serviceCatalogRoutes(fastify: FastifyInstance) {

  // ═════════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═════════════════════════════════════════════════════════════════════════

  // GET /catalog/categories
  fastify.get('/catalog/categories', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const result = await pool.query(
      'SELECT * FROM catalog_categories WHERE is_active = true ORDER BY sort_order ASC, name ASC'
    );
    return reply.send({ data: result.rows });
  });

  // POST /catalog/categories
  fastify.post('/catalog/categories', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO catalog_categories (name, description, icon, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.name, body.description, body.icon, body.sort_order]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /catalog/categories/:id
  fastify.patch('/catalog/categories/:id', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCategorySchema.parse(request.body);

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    const result = await pool.query(
      `UPDATE catalog_categories SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Catalog category not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_catalog_category', 'catalog_categories', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /catalog/categories/:id — soft delete
  fastify.delete('/catalog/categories/:id', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      'UPDATE catalog_categories SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Catalog category not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_catalog_category', 'catalog_categories', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ message: 'Category deleted successfully' });
  });

  // POST /catalog/categories/reorder — bulk reorder
  fastify.post('/catalog/categories/reorder', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const body = z.object({
      order: z.array(z.object({
        id: z.string().uuid(),
        sort_order: z.number().int(),
      })),
    }).parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of body.order) {
        await client.query(
          'UPDATE catalog_categories SET sort_order = $1 WHERE id = $2',
          [item.sort_order, item.id]
        );
      }
      await client.query('COMMIT');
      return reply.send({ message: 'Categories reordered successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ITEMS
  // ═════════════════════════════════════════════════════════════════════════

  // GET /catalog/items
  fastify.get('/catalog/items', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const querySchema = z.object({
      category_id: z.string().uuid().optional(),
      is_active: z.string().optional(),
    });
    const query = querySchema.parse(request.query);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.category_id) {
      whereClause += ` AND ci.category_id = $${paramIdx++}`;
      params.push(query.category_id);
    }
    if (query.is_active !== undefined) {
      whereClause += ` AND ci.is_active = $${paramIdx++}`;
      params.push(query.is_active === 'true');
    } else {
      whereClause += ' AND ci.is_active = true';
    }

    const result = await pool.query(
      `SELECT ci.*, cc.name as category_name, cc.icon as category_icon
       FROM catalog_items ci
       LEFT JOIN catalog_categories cc ON ci.category_id = cc.id
       ${whereClause}
       ORDER BY ci.sort_order ASC, ci.name ASC`,
      params
    );

    return reply.send({ data: result.rows });
  });

  // GET /catalog/items/:id
  fastify.get('/catalog/items/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT ci.*, cc.name as category_name, cc.icon as category_icon
       FROM catalog_items ci
       LEFT JOIN catalog_categories cc ON ci.category_id = cc.id
       WHERE ci.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Catalog item not found' });
    }

    const item = result.rows[0];
    // Parse custom_fields JSONB
    item.custom_fields = typeof item.custom_fields === 'string'
      ? JSON.parse(item.custom_fields)
      : item.custom_fields;

    return reply.send({ data: item });
  });

  // POST /catalog/items
  fastify.post('/catalog/items', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const body = createItemSchema.parse(request.body);

    const result = await pool.query(
      `INSERT INTO catalog_items (name, description, short_description, category_id, icon, image_url, fulfillment_type, approval_required, approval_role, priority, ticket_type, custom_fields, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        body.name, body.description, body.short_description,
        body.category_id || null, body.icon, body.image_url || null,
        body.fulfillment_type, body.approval_required, body.approval_role,
        body.priority, body.ticket_type,
        JSON.stringify(body.custom_fields),
        body.sort_order, request.user.id,
      ]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /catalog/items/:id
  fastify.patch('/catalog/items/:id', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateItemSchema.parse(request.body);

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses: string[] = [];
    const values: any[] = [id];
    let paramIdx = 2;

    for (const field of fields) {
      if (field === 'custom_fields') {
        setClauses.push(`custom_fields = $${paramIdx++}`);
        values.push(JSON.stringify((body as any)[field]));
      } else {
        setClauses.push(`${field} = $${paramIdx++}`);
        values.push((body as any)[field]);
      }
    }

    const result = await pool.query(
      `UPDATE catalog_items SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Catalog item not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_catalog_item', 'catalog_items', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /catalog/items/:id — soft delete
  fastify.delete('/catalog/items/:id', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      'UPDATE catalog_items SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Catalog item not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_catalog_item', 'catalog_items', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ message: 'Item deleted successfully' });
  });

  // POST /catalog/items/reorder — bulk reorder
  fastify.post('/catalog/items/reorder', {
    preHandler: [fastify.requirePermission('manage_catalog')],
  }, async (request, reply) => {
    const body = z.object({
      order: z.array(z.object({
        id: z.string().uuid(),
        sort_order: z.number().int(),
      })),
    }).parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of body.order) {
        await client.query(
          'UPDATE catalog_items SET sort_order = $1 WHERE id = $2',
          [item.sort_order, item.id]
        );
      }
      await client.query('COMMIT');
      return reply.send({ message: 'Items reordered successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SERVICE REQUESTS
  // ═════════════════════════════════════════════════════════════════════════

  // POST /catalog/request — Submit a service request
  fastify.post('/catalog/request', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const body = submitRequestSchema.parse(request.body);
    const jwtUser = request.user;

    // Fetch full user record from DB (has department, title, location, manager_id, etc.)
    const userResult = await pool.query(
      'SELECT id, email, name, role, department, title, location, manager_id FROM users WHERE id = $1',
      [jwtUser.id]
    );
    if (userResult.rows.length === 0) {
      return reply.status(401).send({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch the catalog item
      const itemResult = await client.query(
        'SELECT * FROM catalog_items WHERE id = $1 AND is_active = true',
        [body.catalog_item_id]
      );

      if (itemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Catalog item not found or inactive' });
      }

      const item = itemResult.rows[0];

      // Parse custom_fields & validate required fields
      let customFields: any[] = [];
      if (typeof item.custom_fields === 'string') {
        customFields = JSON.parse(item.custom_fields);
      } else if (Array.isArray(item.custom_fields)) {
        customFields = item.custom_fields;
      }

      for (const field of customFields) {
        if (field.required) {
          const value = body.answers[field.field_key];
          if (value === undefined || value === null || value === '') {
            await client.query('ROLLBACK');
            return reply.status(400).send({ error: `Field "${field.name}" is required` });
          }
        }
      }

      let ticketId: string | null = null;
      let approvalId: string | null = null;
      let status = 'submitted';

      if (item.approval_required) {
        // Create an approval request first
        status = 'pending_approval';

        // Build description from answers
        const answersText = Object.entries(body.answers)
          .map(([key, val]) => `${key}: ${val}`)
          .join('\n');

        const approvalTitle = `${item.name} — ${user.name}`;
        const approvalDesc = `Service request for: ${item.name}\n\n${item.description}\n\nRequested by: ${user.name}\n\nAnswers:\n${answersText}`;

        // ─── Find matching approval routing rule ────────────────────────
        // Build context for rule matching: catalog item fields + user fields
        const matchContext: Record<string, any> = {
          catalog_name: item.name,
          catalog_category: item.category_id,
          catalog_approval_role: item.approval_role,
          requester_role: user.role,
          requester_department: user.department,
          priority: item.priority,
        };
        // Add user attributes
        if (user.department) matchContext.department = user.department;
        if (user.title) matchContext.title = user.title;
        if (user.location) matchContext.location = user.location;

        // Fetch matching rules from DB
        const rulesResult = await pool.query(
          `SELECT * FROM approval_routing_rules
           WHERE enabled = true
           ORDER BY priority ASC`
        );
        const rules = rulesResult.rows;

        let matchedSteps: Array<{ type: string; role?: string; user_id?: string }> = [];
        let matchedRuleName = 'Default: Manager Approval';

        for (const rule of rules) {
          const criteria = typeof rule.match_criteria === 'string'
            ? JSON.parse(rule.match_criteria)
            : rule.match_criteria;

          if (!criteria || criteria.length === 0) {
            // Catch-all rule — use as fallback
            matchedSteps = typeof rule.steps === 'string' ? JSON.parse(rule.steps) : rule.steps;
            matchedRuleName = rule.name;
            continue; // Keep looking for more specific match
          }

          // Evaluate criteria against matchContext
          const allMatch = criteria.every((c: any) => {
            const actual = matchContext[c.field];
            if (actual === undefined) return false;
            switch (c.operator) {
              case 'equals': return String(actual).toLowerCase() === String(c.value).toLowerCase();
              case 'not_equals': return String(actual).toLowerCase() !== String(c.value).toLowerCase();
              case 'contains': return String(actual).toLowerCase().includes(String(c.value).toLowerCase());
              case 'in': return (Array.isArray(c.value) ? c.value : [c.value])
                .some((v: any) => String(actual).toLowerCase() === String(v).toLowerCase());
              default: return false;
            }
          });

          if (allMatch) {
            matchedSteps = typeof rule.steps === 'string' ? JSON.parse(rule.steps) : rule.steps;
            matchedRuleName = rule.name;
            break; // First match wins (by priority order)
          }
        }

        // Fall back to the catalog item's approval_role if no rule matched
        if (matchedSteps.length === 0 && item.approval_role) {
          matchedSteps = [{ type: 'role', role: item.approval_role }];
        }

        // Create the approval request
        const approvalResult = await client.query(
          `INSERT INTO approval_requests (entity_type, entity_id, title, description, priority, requested_by)
           VALUES ('catalog_request', '00000000-0000-0000-0000-000000000000', $1, $2, $3, $4)
           RETURNING *`,
          [approvalTitle, approvalDesc, item.priority, user.id]
        );
        const approval = approvalResult.rows[0];
        approvalId = approval.id;

        // Update the entity_id to the actual approval id
        await client.query(
          `UPDATE approval_requests SET entity_id = $1 WHERE id = $1`,
          [approval.id]
        );

        // Create approval steps from matched rule
        for (let i = 0; i < matchedSteps.length; i++) {
          const stepDef = matchedSteps[i];
          const approverType = stepDef.type || 'role';
          const approverRole = stepDef.role || null;
          const approverId = stepDef.user_id || null;

          await client.query(
            `INSERT INTO approval_steps (request_id, step_index, approver_id, approver_role, approver_type)
             VALUES ($1, $2, $3, $4, $5)`,
            [approval.id, i, approverId, approverRole, approverType]
          );
        }

        // Log creation
        await client.query(
          `INSERT INTO approval_history (request_id, actor_id, action, comment)
           VALUES ($1, $2, 'created', $3)`,
          [approval.id, user.id, `Service catalog request submitted for approval (rule: ${matchedRuleName})`]
        );

        // Notify current step approvers via socket
        if (matchedSteps.length > 0) {
          const firstStep = matchedSteps[0];
          if (firstStep.type === 'role' && firstStep.role) {
            // Notify all users with that role (in a real app we'd do this more efficiently)
            // For now, emit a general event that the UI can listen for
          } else if (firstStep.type === 'manager_of_requester' && user.id) {
            const mgrIdResult = await pool.query(
              'SELECT manager_id FROM users WHERE id = $1 AND manager_id IS NOT NULL',
              [user.id]
            );
            if (mgrIdResult.rows.length > 0) {
              fastify.io.to(`user:${mgrIdResult.rows[0].manager_id}`).emit('approval:updated', {
                approvalId: approval.id,
                action: 'approval_requested',
              });
            }
          } else if (firstStep.type === 'user' && firstStep.user_id) {
            fastify.io.to(`user:${firstStep.user_id}`).emit('approval:updated', {
              approvalId: approval.id,
              action: 'approval_requested',
            });
          }
          // General notification for all admins/approvers
          fastify.io.emit('approval:created', { approval });
        }

        fastify.io.emit('approval:created', { approval });
      } else {
        // Create ticket directly for fulfillment
        status = 'in_progress';

        const answersText = Object.entries(body.answers)
          .map(([key, val]) => `${key}: ${val}`)
          .join('\n');

        const description = `${item.description}\n\n---\nRequested Item: ${item.name}\n\nRequest Details:\n${answersText}`;

        const ticketResult = await client.query(
          `INSERT INTO tickets (title, description, priority, ticket_type, created_by_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [`${item.name} — ${user.name}`, description, item.priority, item.ticket_type, user.id]
        );

        ticketId = ticketResult.rows[0].id;

        // Log ticket activity
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
           VALUES ($1, $2, 'created', 'open')`,
          [ticketId, user.id]
        );
      }

      // Create the service request
      const srResult = await client.query(
        `INSERT INTO service_requests (catalog_item_id, requested_by, status, priority, answers, ticket_id, approval_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [body.catalog_item_id, user.id, status, item.priority, JSON.stringify(body.answers), ticketId, approvalId]
      );

      await client.query('COMMIT');

      // Fetch the complete service request for response
      const fullResult = await pool.query(
        `SELECT sr.*, ci.name as catalog_item_name, ci.icon as catalog_item_icon,
                u.name as requested_by_name, u.email as requested_by_email,
                t.number as ticket_number,
                ar.status as approval_status
         FROM service_requests sr
         LEFT JOIN catalog_items ci ON sr.catalog_item_id = ci.id
         LEFT JOIN users u ON sr.requested_by = u.id
         LEFT JOIN tickets t ON sr.ticket_id = t.id
         LEFT JOIN approval_requests ar ON sr.approval_id = ar.id
         WHERE sr.id = $1`,
        [srResult.rows[0].id]
      );

      // Emit socket event
      fastify.io.emit('catalog:request_created', { serviceRequest: fullResult.rows[0] });

      return reply.status(201).send({ data: fullResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // GET /catalog/requests
  fastify.get('/catalog/requests', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(25),
      status: z.string().optional(),
      catalog_item_id: z.string().uuid().optional(),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Row-level auth: agents/admins see all; users see only their own
    if (request.user.role === 'user') {
      whereClause += ` AND sr.requested_by = $${paramIdx++}`;
      params.push(request.user.id);
    }

    if (query.status) {
      whereClause += ` AND sr.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.catalog_item_id) {
      whereClause += ` AND sr.catalog_item_id = $${paramIdx++}`;
      params.push(query.catalog_item_id);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM service_requests sr ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT sr.*, ci.name as catalog_item_name, ci.icon as catalog_item_icon,
              u.name as requested_by_name, u.email as requested_by_email,
              t.number as ticket_number, t.status as ticket_status,
              ar.status as approval_status
       FROM service_requests sr
       LEFT JOIN catalog_items ci ON sr.catalog_item_id = ci.id
       LEFT JOIN users u ON sr.requested_by = u.id
       LEFT JOIN tickets t ON sr.ticket_id = t.id
       LEFT JOIN approval_requests ar ON sr.approval_id = ar.id
       ${whereClause}
       ORDER BY sr.created_at DESC
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

  // GET /catalog/requests/:id
  fastify.get('/catalog/requests/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT sr.*, ci.name as catalog_item_name, ci.icon as catalog_item_icon,
              ci.description as catalog_item_description,
              ci.custom_fields, ci.fulfillment_type,
              u.name as requested_by_name, u.email as requested_by_email,
              t.number as ticket_number, t.status as ticket_status, t.id as ticket_id,
              t.title as ticket_title,
              ar.status as approval_status
       FROM service_requests sr
       LEFT JOIN catalog_items ci ON sr.catalog_item_id = ci.id
       LEFT JOIN users u ON sr.requested_by = u.id
       LEFT JOIN tickets t ON sr.ticket_id = t.id
       LEFT JOIN approval_requests ar ON sr.approval_id = ar.id
       WHERE sr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Service request not found' });
    }

    const sr = result.rows[0];

    // Row-level auth
    if (request.user.role === 'user' && sr.requested_by !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    return reply.send({ data: sr });
  });

  // PATCH /catalog/requests/:id/fulfill
  fastify.patch('/catalog/requests/:id/fulfill', {
    preHandler: [fastify.requirePermission('view_catalog')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      fulfillment_notes: z.string().optional().default(''),
    }).parse(request.body);

    const result = await pool.query(
      `UPDATE service_requests
       SET status = 'fulfilled', fulfilled_by = $1, fulfilled_at = NOW(), fulfillment_notes = $2
       WHERE id = $3 AND status NOT IN ('fulfilled', 'cancelled')
       RETURNING *`,
      [request.user.id, body.fulfillment_notes, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Service request not found or already fulfilled/cancelled' });
    }

    // Find associated ticket and close it
    if (result.rows[0].ticket_id) {
      await pool.query(
        `UPDATE tickets SET status = 'resolved', close_notes = $1
         WHERE id = $2`,
        [body.fulfillment_notes || 'Fulfilled via service catalog', result.rows[0].ticket_id]
      );
    }

    // Emit socket event
    fastify.io.emit('catalog:request_fulfilled', { serviceRequest: result.rows[0] });

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'fulfill_service_request', 'service_requests', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // PATCH /catalog/requests/:id/cancel
  fastify.patch('/catalog/requests/:id/cancel', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Fetch the request to check ownership
    const existing = await pool.query(
      'SELECT * FROM service_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Service request not found' });
    }

    const sr = existing.rows[0];

    // Only requester or admin can cancel
    if (request.user.role !== 'admin' && sr.requested_by !== request.user.id) {
      return reply.status(403).send({ error: 'Only the requester or an admin can cancel this request' });
    }

    if (['fulfilled', 'cancelled'].includes(sr.status)) {
      return reply.status(400).send({ error: `Cannot cancel: request is already ${sr.status}` });
    }

    const result = await pool.query(
      `UPDATE service_requests SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );

    // Cancel associated approval request if any
    if (sr.approval_id) {
      try {
        await pool.query(
          `UPDATE approval_requests SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
          [sr.approval_id]
        );
      } catch { /* non-critical */ }
    }

    // Cancel associated open ticket if any
    if (sr.ticket_id) {
      try {
        await pool.query(
          `UPDATE tickets SET status = 'closed', close_notes = 'Service request cancelled' WHERE id = $1 AND status NOT IN ('resolved', 'closed')`,
          [sr.ticket_id]
        );
      } catch { /* non-critical */ }
    }

    fastify.io.emit('catalog:request_cancelled', { serviceRequest: result.rows[0] });

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'cancel_service_request', 'service_requests', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });
}
