import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'textarea'] as const;
const ENTITY_TYPES = ['ticket', 'asset'] as const;

const createFieldSchema = z.object({
  name: z.string().min(1).max(200),
  field_key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Must be lowercase alphanumeric with underscores'),
  field_type: z.enum(FIELD_TYPES),
  entity_type: z.enum(ENTITY_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  default_value: z.string().optional(),
  placeholder: z.string().optional(),
  help_text: z.string().optional(),
  sort_order: z.number().int().default(0),
});

const updateFieldSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  default_value: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  help_text: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const valueUpsertSchema = z.object({
  values: z.array(z.object({
    definition_id: z.string().uuid(),
    value: z.any().optional(),
  })),
});

export default async function customFieldRoutes(fastify: FastifyInstance) {
  // GET /custom-fields — List all field definitions, filterable by entity_type
  fastify.get('/custom-fields', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['custom-fields'],
      summary: 'List custom field definitions',
      querystring: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['ticket', 'asset'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const querySchema = z.object({
      entity_type: z.enum(ENTITY_TYPES).optional(),
    });
    const query = querySchema.parse(request.query);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.entity_type) {
      whereClause += ` AND entity_type = $${paramIdx++}`;
      params.push(query.entity_type);
    }

    const result = await pool.query(
      `SELECT * FROM custom_field_definitions ${whereClause} ORDER BY entity_type, sort_order ASC, name ASC`,
      params
    );

    return reply.send({ data: result.rows });
  });

  // GET /custom-fields/:id — Get single definition
  fastify.get('/custom-fields/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['custom-fields'],
      summary: 'Get custom field definition by ID',
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Custom field definition not found' });
    }
    return reply.send({ data: result.rows[0] });
  });

  // POST /custom-fields — Create a new field definition (admin only)
  fastify.post('/custom-fields', {
    preHandler: [fastify.requirePermission('manage_custom_fields')],
    schema: {
      tags: ['custom-fields'],
      summary: 'Create a custom field definition',
      body: {
        type: 'object',
        required: ['name', 'field_key', 'field_type', 'entity_type'],
        properties: {
          name: { type: 'string', description: 'Display name' },
          field_key: { type: 'string', description: 'Programmatic key (lowercase, alphanumeric + underscores)' },
          field_type: { type: 'string', enum: FIELD_TYPES },
          entity_type: { type: 'string', enum: ENTITY_TYPES },
          required: { type: 'boolean' },
          options: { type: 'array', items: { type: 'string' } },
          default_value: { type: 'string' },
          placeholder: { type: 'string' },
          help_text: { type: 'string' },
          sort_order: { type: 'integer' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = createFieldSchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO custom_field_definitions (name, field_key, field_type, entity_type, required, options, default_value, placeholder, help_text, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [body.name, body.field_key, body.field_type, body.entity_type, body.required, body.options, body.default_value || null, body.placeholder || null, body.help_text || null, body.sort_order, request.user.id]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /custom-fields/:id — Update a field definition (admin only)
  fastify.patch('/custom-fields/:id', {
    preHandler: [fastify.requirePermission('manage_custom_fields')],
    schema: {
      tags: ['custom-fields'],
      summary: 'Update a custom field definition',
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateFieldSchema.parse(request.body);

    // Cannot change field_key, field_type, or entity_type after creation
    const forbidden = ['field_key', 'field_type', 'entity_type'];
    for (const key of forbidden) {
      if ((body as any)[key] !== undefined) {
        return reply.status(400).send({ error: `Cannot change '${key}' after creation` });
      }
    }

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    const result = await pool.query(
      `UPDATE custom_field_definitions SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Custom field definition not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_custom_field', 'custom_field_definitions', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: result.rows[0] });
  });

  // DELETE /custom-fields/:id — Soft-delete (set is_active = false) + delete values (admin only)
  fastify.delete('/custom-fields/:id', {
    preHandler: [fastify.requirePermission('manage_custom_fields')],
    schema: {
      tags: ['custom-fields'],
      summary: 'Delete a custom field definition (soft-delete + removes values)',
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete associated values first
      await client.query('DELETE FROM custom_field_values WHERE definition_id = $1', [id]);

      // Soft-delete the definition
      const result = await client.query(
        'UPDATE custom_field_definitions SET is_active = false WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Custom field definition not found' });
      }

      await client.query('COMMIT');

      try {
        await pool.query(
          'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
          [request.user.id, 'delete_custom_field', 'custom_field_definitions', id]
        );
      } catch (logErr: any) {
        fastify.log.error({ err: logErr }, 'Failed to write audit log');
      }

      return reply.send({ message: 'Custom field definition deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // GET /custom-fields/values/:entityType/:entityId — Get all custom field values for an entity
  fastify.get('/custom-fields/values/:entityType/:entityId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['custom-fields'],
      summary: 'Get custom field values for an entity',
    },
  }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };

    if (!ENTITY_TYPES.includes(entityType as any)) {
      return reply.status(400).send({ error: 'Invalid entity type. Must be "ticket" or "asset"' });
    }

    // Row-level security: users can only view their own tickets
    if (entityType === 'ticket' && request.user.role === 'user') {
      const ticketCheck = await pool.query(
        'SELECT created_by_id, assigned_to_id FROM tickets WHERE id = $1',
        [entityId]
      );
      if (ticketCheck.rows.length > 0) {
        const t = ticketCheck.rows[0];
        if (t.created_by_id !== request.user.id && t.assigned_to_id !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }
    }

    const result = await pool.query(
      `SELECT cfv.*, cfd.name, cfd.field_key, cfd.field_type, cfd.options, cfd.required, cfd.placeholder, cfd.help_text, cfd.default_value
       FROM custom_field_values cfv
       JOIN custom_field_definitions cfd ON cfd.id = cfv.definition_id
       WHERE cfv.entity_id = $1 AND cfd.entity_type = $2 AND cfd.is_active = true
       ORDER BY cfd.sort_order ASC, cfd.name ASC`,
      [entityId, entityType]
    );

    return reply.send({ data: result.rows });
  });

  // PUT /custom-fields/values/:entityType/:entityId — Set/update custom field values for an entity
  fastify.put('/custom-fields/values/:entityType/:entityId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['custom-fields'],
      summary: 'Set custom field values for an entity',
    },
  }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };
    const body = valueUpsertSchema.parse(request.body);

    if (!ENTITY_TYPES.includes(entityType as any)) {
      return reply.status(400).send({ error: 'Invalid entity type. Must be "ticket" or "asset"' });
    }

    // Row-level security: users can only set values on their own tickets
    if (entityType === 'ticket' && request.user.role === 'user') {
      const ticketCheck = await pool.query(
        'SELECT created_by_id, assigned_to_id FROM tickets WHERE id = $1',
        [entityId]
      );
      if (ticketCheck.rows.length > 0) {
        const t = ticketCheck.rows[0];
        if (t.created_by_id !== request.user.id && t.assigned_to_id !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const cf of body.values) {
        // Get field definition to validate type
        const defResult = await client.query(
          'SELECT * FROM custom_field_definitions WHERE id = $1 AND entity_type = $2 AND is_active = true',
          [cf.definition_id, entityType]
        );

        if (defResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: `Invalid definition_id: ${cf.definition_id}` });
        }

        const def = defResult.rows[0];

        // Validate required fields
        if (def.required && (cf.value === undefined || cf.value === null || cf.value === '')) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: `Field "${def.name}" is required` });
        }

        let valueText: string | null = null;
        let valueNumber: number | null = null;
        let valueDate: string | null = null;
        let valueBoolean: boolean | null = null;
        let valueArray: string[] = [];

        // Map value based on field type
        if (cf.value !== undefined && cf.value !== null && cf.value !== '') {
          switch (def.field_type) {
            case 'text':
            case 'textarea':
            case 'url':
              valueText = String(cf.value);
              break;
            case 'number':
              valueNumber = Number(cf.value);
              if (isNaN(valueNumber)) {
                await client.query('ROLLBACK');
                return reply.status(400).send({ error: `Field "${def.name}" must be a number` });
              }
              break;
            case 'date':
              valueDate = new Date(cf.value).toISOString();
              if (valueDate === 'Invalid Date') {
                await client.query('ROLLBACK');
                return reply.status(400).send({ error: `Field "${def.name}" must be a valid date` });
              }
              break;
            case 'select':
              if (!def.options.includes(cf.value)) {
                await client.query('ROLLBACK');
                return reply.status(400).send({ error: `Field "${def.name}": "${cf.value}" is not a valid option` });
              }
              valueText = String(cf.value);
              break;
            case 'multi_select':
              if (Array.isArray(cf.value)) {
                valueArray = cf.value;
              } else if (typeof cf.value === 'string') {
                valueArray = cf.value.split(',').map((s: string) => s.trim());
              }
              break;
            case 'checkbox':
              valueBoolean = Boolean(cf.value);
              break;
          }
        }

        await client.query(
          `INSERT INTO custom_field_values (definition_id, entity_id, value_text, value_number, value_date, value_boolean, value_array)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (definition_id, entity_id)
           DO UPDATE SET value_text = $3, value_number = $4, value_date = $5, value_boolean = $6, value_array = $7`,
          [cf.definition_id, entityId, valueText, valueNumber, valueDate, valueBoolean, valueArray]
        );
      }

      await client.query('COMMIT');

      // Return updated values
      const result = await pool.query(
        `SELECT cfv.*, cfd.name, cfd.field_key, cfd.field_type, cfd.options, cfd.required
         FROM custom_field_values cfv
         JOIN custom_field_definitions cfd ON cfd.id = cfv.definition_id
         WHERE cfv.entity_id = $1 AND cfd.entity_type = $2 AND cfd.is_active = true
         ORDER BY cfd.sort_order ASC, cfd.name ASC`,
        [entityId, entityType]
      );

      return reply.send({ data: result.rows });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
