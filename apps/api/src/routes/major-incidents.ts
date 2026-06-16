import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { eventBus } from '../services/event-bus';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const declareSchema = z.object({
  ticket_id: z.string().uuid(),
  incident_commander_id: z.string().uuid().optional(),
  bridge_url: z.string().max(500).optional(),
  bridge_conference: z.string().max(500).optional(),
  bridge_slack_channel: z.string().max(200).optional(),
  services_affected: z.array(z.string()).default([]),
});

const updateSchema = z.object({
  status: z.enum(['active', 'stabilized', 'resolved', 'post_review']).optional(),
  incident_commander_id: z.string().uuid().nullable().optional(),
  bridge_url: z.string().max(500).nullable().optional(),
  bridge_conference: z.string().max(500).nullable().optional(),
  bridge_slack_channel: z.string().max(200).nullable().optional(),
  services_affected: z.array(z.string()).optional(),
  comms_template: z.string().nullable().optional(),
  pir_notes: z.string().nullable().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  status: z.enum(['active', 'stabilized', 'resolved', 'post_review']).optional(),
  incident_commander_id: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

const timelineEntrySchema = z.object({
  entry_type: z.enum(['declaration', 'update', 'milestone', 'communication', 'resolution', 'pir']),
  content: z.string().min(1),
  author_id: z.string().uuid().optional(),
});

const completePirSchema = z.object({
  pir_notes: z.string().default(''),
});

export default async function majorIncidentRoutes(fastify: FastifyInstance) {

  // ─────────────────────────────────────────────────────────────────────────────
  //  HELPER: fetch a single major incident with ticket + commander joins
  // ─────────────────────────────────────────────────────────────────────────────
  async function fetchMajorIncident(ticketId: string) {
    const result = await pool.query(
      `SELECT mi.*,
        t.title as ticket_title, t.number as ticket_number, t.description as ticket_description,
        t.status as ticket_status, t.priority as ticket_priority,
        t.created_by_id as ticket_created_by_id, t.created_at as ticket_created_at,
        u.id as commander_id, u.name as commander_name, u.email as commander_email, u.avatar_url as commander_avatar
       FROM major_incidents mi
       JOIN tickets t ON mi.ticket_id = t.id
       LEFT JOIN users u ON mi.incident_commander_id = u.id
       WHERE mi.ticket_id = $1`,
      [ticketId]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Fetch timeline
    const timelineResult = await pool.query(
      `SELECT mit.*, u.name as author_name, u.avatar_url as author_avatar
       FROM major_incident_timeline mit
       LEFT JOIN users u ON mit.author_id = u.id
       WHERE mit.major_incident_ticket_id = $1
       ORDER BY mit.timestamp DESC`,
      [ticketId]
    );

    return {
      ...row,
      timeline: timelineResult.rows,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /major-incidents — list major incidents with pagination, search, filters
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.get('/major-incidents', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const query = listQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.status) {
      whereClause += ` AND mi.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.incident_commander_id) {
      whereClause += ` AND mi.incident_commander_id = $${paramIdx++}`;
      params.push(query.incident_commander_id);
    }
    if (query.search) {
      whereClause += ` AND (t.title ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM major_incidents mi
       JOIN tickets t ON mi.ticket_id = t.id
       ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT mi.*,
        t.title as ticket_title, t.number as ticket_number, t.priority as ticket_priority,
        t.status as ticket_status, t.created_by_id as ticket_created_by_id,
        u.id as commander_id, u.name as commander_name, u.email as commander_email, u.avatar_url as commander_avatar,
        cu.name as created_by_name
       FROM major_incidents mi
       JOIN tickets t ON mi.ticket_id = t.id
       LEFT JOIN users u ON mi.incident_commander_id = u.id
       LEFT JOIN users cu ON t.created_by_id = cu.id
       ${whereClause}
       ORDER BY mi.declaration_time DESC
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

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /major-incidents/:ticketId — single major incident with timeline
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.get('/major-incidents/:ticketId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { ticketId } = request.params as { ticketId: string };

    const incident = await fetchMajorIncident(ticketId);
    if (!incident) {
      return reply.status(404).send({ error: 'Major incident not found' });
    }

    return reply.send({ data: incident });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  POST /major-incidents/declare — declare a major incident from a critical ticket
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.post('/major-incidents/declare', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = declareSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ticket exists, is an incident, and is critical priority
      const ticketResult = await client.query(
        `SELECT id, ticket_type, priority FROM tickets WHERE id = $1`,
        [body.ticket_id]
      );
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Ticket not found' });
      }

      const ticket = ticketResult.rows[0];
      if (ticket.ticket_type !== 'incident') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Only tickets of type "incident" can be declared as major incidents' });
      }
      if (ticket.priority !== 'critical') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Only critical priority tickets can be declared as major incidents' });
      }

      // Check major_incidents doesn't already exist for this ticket
      const existingResult = await client.query(
        `SELECT ticket_id FROM major_incidents WHERE ticket_id = $1`,
        [body.ticket_id]
      );
      if (existingResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: 'Major incident already declared for this ticket' });
      }

      // Insert into major_incidents
      const insertResult = await client.query(
        `INSERT INTO major_incidents (ticket_id, incident_commander_id, bridge_url, bridge_conference,
          bridge_slack_channel, services_affected)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          body.ticket_id,
          body.incident_commander_id || null,
          body.bridge_url || null,
          body.bridge_conference || null,
          body.bridge_slack_channel || null,
          body.services_affected,
        ]
      );

      // Create auto timeline entry for declaration
      await client.query(
        `INSERT INTO major_incident_timeline (major_incident_ticket_id, entry_type, content, author_id)
         VALUES ($1, 'declaration', $2, $3)`,
        [body.ticket_id, 'Major incident declared', request.user.id]
      );

      await client.query('COMMIT');

      const created = await fetchMajorIncident(body.ticket_id);

      // Publish event
      eventBus.publish('major_incident.declared', {
        entityType: 'major_incident',
        entityId: body.ticket_id,
        actorId: request.user.id,
        data: {
          ticket_id: body.ticket_id,
          incident_commander_id: body.incident_commander_id || null,
          services_affected: body.services_affected,
        },
      });

      return reply.status(201).send({ data: created });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  PATCH /major-incidents/:ticketId — update major incident
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.patch('/major-incidents/:ticketId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { ticketId } = request.params as { ticketId: string };
    const body = updateSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current major incident
      const current = await client.query('SELECT ticket_id, status, incident_commander_id, bridge_url, bridge_conference, bridge_slack_channel, declaration_time, resolved_time, services_affected, comms_template, pir_completed, pir_notes, created_at, updated_at FROM major_incidents WHERE ticket_id = $1', [ticketId]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Major incident not found' });
      }

      const incident = current.rows[0];

      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (body.status !== undefined) { updates.push(`status = $${paramIdx++}`); params.push(body.status); }
      if (body.incident_commander_id !== undefined) { updates.push(`incident_commander_id = $${paramIdx++}`); params.push(body.incident_commander_id); }
      if (body.bridge_url !== undefined) { updates.push(`bridge_url = $${paramIdx++}`); params.push(body.bridge_url); }
      if (body.bridge_conference !== undefined) { updates.push(`bridge_conference = $${paramIdx++}`); params.push(body.bridge_conference); }
      if (body.bridge_slack_channel !== undefined) { updates.push(`bridge_slack_channel = $${paramIdx++}`); params.push(body.bridge_slack_channel); }
      if (body.services_affected !== undefined) { updates.push(`services_affected = $${paramIdx++}`); params.push(body.services_affected); }
      if (body.comms_template !== undefined) { updates.push(`comms_template = $${paramIdx++}`); params.push(body.comms_template); }
      if (body.pir_notes !== undefined) { updates.push(`pir_notes = $${paramIdx++}`); params.push(body.pir_notes); }

      // Auto-set resolved_time based on status transitions
      const newStatus = body.status || incident.status;
      if (body.status === 'resolved' && incident.status !== 'resolved') {
        updates.push(`resolved_time = NOW()`);
      } else if (body.status && body.status !== 'resolved' && incident.status === 'resolved') {
        updates.push(`resolved_time = NULL`);
      }

      if (updates.length > 0) {
        params.push(ticketId);
        await client.query(
          `UPDATE major_incidents SET ${updates.join(', ')} WHERE ticket_id = $${paramIdx}`,
          params
        );
      }

      // Log timeline entry if status changed
      if (body.status && body.status !== incident.status) {
        await client.query(
          `INSERT INTO major_incident_timeline (major_incident_ticket_id, entry_type, content, author_id)
           VALUES ($1, $2, $3, $4)`,
          [
            ticketId,
            body.status === 'resolved' ? 'resolution' : 'update',
            `Status changed from ${incident.status} to ${body.status}`,
            request.user.id,
          ]
        );
      }

      // Log other tracked field changes
      const trackedFields = ['incident_commander_id', 'bridge_url', 'bridge_conference', 'bridge_slack_channel', 'services_affected', 'comms_template', 'pir_notes'];
      for (const field of trackedFields) {
        const bodyVal = (body as any)[field];
        if (bodyVal !== undefined && JSON.stringify(bodyVal) !== JSON.stringify((incident as any)[field])) {
          await client.query(
            `INSERT INTO major_incident_timeline (major_incident_ticket_id, entry_type, content, author_id)
             VALUES ($1, 'update', $2, $3)`,
            [
              ticketId,
              `Updated ${field}`,
              request.user.id,
            ]
          );
        }
      }

      await client.query('COMMIT');

      const updated = await fetchMajorIncident(ticketId);

      // Publish event if resolved
      if (body.status === 'resolved' && incident.status !== 'resolved') {
        eventBus.publish('major_incident.resolved', {
          entityType: 'major_incident',
          entityId: ticketId,
          actorId: request.user.id,
          data: { ticket_id: ticketId, previous_status: incident.status, new_status: body.status },
          previousData: { status: incident.status },
        });
      }

      return reply.send({ data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  POST /major-incidents/:ticketId/timeline — add timeline entry
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.post('/major-incidents/:ticketId/timeline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { ticketId } = request.params as { ticketId: string };
    const body = timelineEntrySchema.parse(request.body);

    // Verify major incident exists
    const exists = await pool.query('SELECT ticket_id FROM major_incidents WHERE ticket_id = $1', [ticketId]);
    if (exists.rows.length === 0) {
      return reply.status(404).send({ error: 'Major incident not found' });
    }

    const authorId = body.author_id || request.user.id;

    const result = await pool.query(
      `INSERT INTO major_incident_timeline (major_incident_ticket_id, entry_type, content, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, body.entry_type, body.content, authorId]
    );

    const entry = result.rows[0];

    // Fetch author name for response
    const authorResult = await pool.query('SELECT name, avatar_url FROM users WHERE id = $1', [authorId]);
    entry.author_name = authorResult.rows[0]?.name || null;
    entry.author_avatar = authorResult.rows[0]?.avatar_url || null;

    return reply.status(201).send({ data: entry });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /major-incidents/:ticketId/timeline — list timeline entries
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.get('/major-incidents/:ticketId/timeline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { ticketId } = request.params as { ticketId: string };

    // Verify major incident exists
    const exists = await pool.query('SELECT ticket_id FROM major_incidents WHERE ticket_id = $1', [ticketId]);
    if (exists.rows.length === 0) {
      return reply.status(404).send({ error: 'Major incident not found' });
    }

    const result = await pool.query(
      `SELECT mit.*, u.name as author_name, u.avatar_url as author_avatar
       FROM major_incident_timeline mit
       LEFT JOIN users u ON mit.author_id = u.id
       WHERE mit.major_incident_ticket_id = $1
       ORDER BY mit.timestamp DESC`,
      [ticketId]
    );

    return reply.send({ data: result.rows });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  POST /major-incidents/:ticketId/complete-pir — complete PIR process
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.post('/major-incidents/:ticketId/complete-pir', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { ticketId } = request.params as { ticketId: string };
    const body = completePirSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT ticket_id FROM major_incidents WHERE ticket_id = $1 FOR UPDATE', [ticketId]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Major incident not found' });
      }

      await client.query(
        `UPDATE major_incidents SET pir_completed = true, pir_notes = $1, status = 'post_review' WHERE ticket_id = $2`,
        [body.pir_notes, ticketId]
      );

      // Add PIR timeline entry
      await client.query(
        `INSERT INTO major_incident_timeline (major_incident_ticket_id, entry_type, content, author_id)
         VALUES ($1, 'pir', $2, $3)`,
        [ticketId, 'Post-incident review completed', request.user.id]
      );

      await client.query('COMMIT');

      const updated = await fetchMajorIncident(ticketId);
      return reply.send({ data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  POST /major-incidents/:ticketId/resolve — quick resolve shortcut
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.post('/major-incidents/:ticketId/resolve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { ticketId } = request.params as { ticketId: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query('SELECT ticket_id, status FROM major_incidents WHERE ticket_id = $1 FOR UPDATE', [ticketId]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Major incident not found' });
      }

      const incident = current.rows[0];

      if (incident.status === 'resolved') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Major incident is already resolved' });
      }

      await client.query(
        `UPDATE major_incidents SET status = 'resolved', resolved_time = NOW() WHERE ticket_id = $1`,
        [ticketId]
      );

      // Add resolution timeline entry
      await client.query(
        `INSERT INTO major_incident_timeline (major_incident_ticket_id, entry_type, content, author_id)
         VALUES ($1, 'resolution', $2, $3)`,
        [ticketId, 'Major incident resolved', request.user.id]
      );

      await client.query('COMMIT');

      const updated = await fetchMajorIncident(ticketId);

      // Publish event
      eventBus.publish('major_incident.resolved', {
        entityType: 'major_incident',
        entityId: ticketId,
        actorId: request.user.id,
        data: { ticket_id: ticketId, previous_status: incident.status, new_status: 'resolved' },
        previousData: { status: incident.status },
      });

      return reply.send({ data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
