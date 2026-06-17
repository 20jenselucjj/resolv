import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { getCached, setCache, clearCache } from '../lib/cache';

const slaPolicySchema = z.object({
  name: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  response_time_hours: z.number().nonnegative(),
  resolution_time_hours: z.number().nonnegative(),
});

const updateSlaPolicySchema = slaPolicySchema.partial();

export default async function slaRoutes(fastify: FastifyInstance) {
  // GET /sla-policies - list all SLA policies (authenticated)
  fastify.get('/sla-policies', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['sla'],
      summary: 'List all active SLA policies',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                  response_time_hours: { type: 'number' },
                  resolution_time_hours: { type: 'number' },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const cached = getCached<any[]>('sla-policies:all');
    if (cached) return reply.send({ data: cached });

    const result = await pool.query(
      'SELECT * FROM sla_policies WHERE is_active = true ORDER BY priority DESC'
    );
    setCache('sla-policies:all', result.rows);
    return reply.send({ data: result.rows });
  });

  // POST /sla-policies - create (admin only)
  fastify.post('/sla-policies', {
    preHandler: [fastify.requirePermission('manage_sla')],
    schema: {
      tags: ['sla'],
      summary: 'Create a new SLA policy',
      body: {
        type: 'object',
        required: ['name', 'priority', 'response_time_hours', 'resolution_time_hours'],
        properties: {
          name: { type: 'string', description: 'SLA policy name' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Ticket priority level' },
          response_time_hours: { type: 'number', description: 'Target response time in hours' },
          resolution_time_hours: { type: 'number', description: 'Target resolution time in hours' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                response_time_hours: { type: 'number' },
                resolution_time_hours: { type: 'number' },
                is_active: { type: 'boolean' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = slaPolicySchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO sla_policies (name, priority, response_time_hours, resolution_time_hours)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [body.name, body.priority, body.response_time_hours, body.resolution_time_hours]
    );
    clearCache('sla-policies');
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /sla-policies/:id - update (admin only)
  fastify.patch('/sla-policies/:id', { preHandler: [fastify.requirePermission('manage_sla')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSlaPolicySchema.parse(request.body);

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    const result = await pool.query(
      `UPDATE sla_policies SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'SLA policy not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_sla_policy', 'sla_policies', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    clearCache('sla-policies');
    return reply.send({ data: result.rows[0] });
  });

  // DELETE /sla-policies/:id - soft delete (admin only)
  fastify.delete('/sla-policies/:id', { preHandler: [fastify.requirePermission('manage_sla')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'UPDATE sla_policies SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'SLA policy not found' });
    }

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [request.user.id, 'delete_sla_policy', 'sla_policies', id]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    clearCache('sla-policies');
    return reply.send({ message: 'SLA policy deactivated successfully' });
  });
  // ─── SLA Breach Detection ──────────────────────────────────────────────────

  // POST /sla/breach-detection — Run SLA breach detection manually
  fastify.post('/sla/breach-detection', {
    preHandler: [fastify.requirePermission('manage_sla')],
    schema: {
      tags: ['sla'],
      summary: 'Run SLA breach detection scan (marks overdue tickets)',
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            breached_count: { type: 'integer' },
            breaches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticket_id: { type: 'string' },
                  ticket_number: { type: 'integer' },
                  ticket_title: { type: 'string' },
                  priority: { type: 'string' },
                  sla_policy_name: { type: 'string' },
                  hours_overdue: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { runSlaBreachDetection } = await import('../services/sla-engine');
      const breaches = await runSlaBreachDetection();
      return reply.send({
        message: `SLA breach detection complete. ${breaches.length} ticket(s) newly marked as breached.`,
        breached_count: breaches.length,
        breaches: breaches.map(b => ({
          ticket_id: b.ticket_id,
          ticket_number: b.ticket_number,
          ticket_title: b.ticket_title,
          priority: b.priority,
          sla_policy_name: b.sla_policy_name,
          hours_overdue: b.hours_overdue,
        })),
      });
    } catch (err: any) {
      fastify.log.error({ err }, 'SLA breach detection failed');
      return reply.status(500).send({ error: 'SLA breach detection failed' });
    }
  });

  // ─── SLA Stats ─────────────────────────────────────────────────────────────

  // GET /sla/stats — Get SLA compliance statistics
  fastify.get('/sla/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['sla'],
      summary: 'Get SLA compliance statistics',
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date-time', description: 'Filter from date' },
          dateTo: { type: 'string', format: 'date-time', description: 'Filter to date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                total_tickets_with_sla: { type: 'integer' },
                breached_count: { type: 'integer' },
                compliant_count: { type: 'integer' },
                compliance_rate: { type: 'number' },
                avg_response_time_hours: { type: 'number' },
                avg_resolution_time_hours: { type: 'number' },
                by_priority: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      priority: { type: 'string' },
                      total: { type: 'integer' },
                      breached: { type: 'integer' },
                      compliant: { type: 'integer' },
                      rate: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { getSlaStats } = await import('../services/sla-engine');
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const stats = await getSlaStats(query.dateFrom, query.dateTo);
      return reply.send({ data: stats });
    } catch (err: any) {
      fastify.log.error({ err }, 'Failed to get SLA stats');
      return reply.status(500).send({ error: 'Failed to get SLA stats' });
    }
  });

  // ─── Breached Tickets List ────────────────────────────────────────────────

  // GET /sla/breaches — List breached tickets
  fastify.get('/sla/breaches', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['sla'],
      summary: 'List tickets with SLA breaches',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50, description: 'Results per page' },
          offset: { type: 'integer', default: 0, description: 'Page offset' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Filter by priority' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                tickets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      number: { type: 'integer' },
                      title: { type: 'string' },
                      priority: { type: 'string' },
                      status: { type: 'string' },
                      created_at: { type: 'string' },
                      due_date: { type: 'string' },
                      sla_breached_at: { type: 'string' },
                      sla_policy_name: { type: 'string' },
                      assigned_to_name: { type: 'string' },
                    },
                  },
                },
                total: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { getBreachedTickets } = await import('../services/sla-engine');
      const query = request.query as { limit?: number; offset?: number; priority?: string };
      const result = await getBreachedTickets(
        query.limit || 50,
        query.offset || 0,
        query.priority
      );
      return reply.send({ data: result });
    } catch (err: any) {
      fastify.log.error({ err }, 'Failed to get breached tickets');
      return reply.status(500).send({ error: 'Failed to get breached tickets' });
    }
  });
}

