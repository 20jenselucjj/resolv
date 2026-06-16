import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { eventBus } from '../services/event-bus';

const createProblemSchema = z.object({
  title: z.string().min(3).max(500),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category_id: z.string().uuid().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

const updateProblemSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'investigating', 'identified', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  root_cause: z.string().nullable().optional(),
  workaround: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const linkIncidentSchema = z.object({
  incident_id: z.string().uuid(),
  link_type: z.enum(['related', 'caused_by', 'contributing']).default('related'),
});

const createActivitySchema = z.object({
  action: z.string().min(1).max(100),
  old_value: z.string().nullable().optional(),
  new_value: z.string().nullable().optional(),
});

export default async function problemRoutes(fastify: FastifyInstance) {

  // ========== PROBLEMS ==========

  // GET /problems — list problems with pagination, search, filters
  fastify.get('/problems', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(25),
      status: z.enum(['open', 'investigating', 'identified', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assignedToMe: z.string().optional(),
      search: z.string().max(200).optional(),
    });
    const query = querySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    // Problems are internal — only admins and agents can list
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (query.status) {
      whereClause += ` AND p.status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query.priority) {
      whereClause += ` AND p.priority = $${paramIdx++}`;
      params.push(query.priority);
    }
    if (query.assignedToMe === 'true') {
      whereClause += ` AND p.assigned_to_id = $${paramIdx++}`;
      params.push(request.user.id);
    }
    if (query.search) {
      whereClause += ` AND (p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx} OR p.number::text ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM problems p ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT p.*, 
        u1.name as created_by_name,
        u2.name as assigned_to_name, u2.avatar_url as assigned_to_avatar,
        c.name as category_name, c.color as category_color,
        (SELECT COUNT(*) FROM problem_incident_links pil WHERE pil.problem_id = p.id) as linked_incidents_count
       FROM problems p
       LEFT JOIN users u1 ON p.created_by_id = u1.id
       LEFT JOIN users u2 ON p.assigned_to_id = u2.id
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
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

  // GET /problems/:id — get problem with linked incidents, known errors, activity
  fastify.get('/problems/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT p.*, 
        u1.name as created_by_name, u1.email as created_by_email,
        u2.name as assigned_to_name, u2.email as assigned_to_email, u2.avatar_url as assigned_to_avatar,
        c.name as category_name, c.color as category_color
       FROM problems p
       LEFT JOIN users u1 ON p.created_by_id = u1.id
       LEFT JOIN users u2 ON p.assigned_to_id = u2.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Problem not found' });
    }

    const problem = result.rows[0];

    // Get linked incidents
    const linkedIncidents = await pool.query(
      `SELECT t.id, t.number, t.title, t.status, t.priority, t.created_at,
              pil.link_type, pil.id as link_id,
              u.name as assigned_to_name
       FROM problem_incident_links pil
       JOIN tickets t ON t.id = pil.incident_id
       LEFT JOIN users u ON t.assigned_to_id = u.id
       WHERE pil.problem_id = $1
       ORDER BY pil.created_at DESC`,
      [id]
    );

    // Get activity
    const activity = await pool.query(
      `SELECT pa.*, u.name as actor_name
       FROM problem_activity pa
       JOIN users u ON pa.actor_id = u.id
       WHERE pa.problem_id = $1
       ORDER BY pa.created_at ASC`,
      [id]
    );

    return reply.send({
      data: {
        ...problem,
        linked_incidents: linkedIncidents.rows,
        activity: activity.rows,
      },
    });
  });

  // POST /problems — create problem
  fastify.post('/problems', { preHandler: [fastify.requirePermission('manage_problems')] }, async (request, reply) => {
    const body = createProblemSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO problems (title, description, priority, category_id, assigned_to_id, tags, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [body.title, body.description, body.priority, body.category_id || null, body.assigned_to_id || null, body.tags, request.user.id]
      );

      const rawProblem = result.rows[0];

      // Populate joins
      const populatedResult = await client.query(
        `SELECT p.*, 
          u1.name as created_by_name,
          u2.name as assigned_to_name, u2.avatar_url as assigned_to_avatar,
          c.name as category_name, c.color as category_color
         FROM problems p
         LEFT JOIN users u1 ON p.created_by_id = u1.id
         LEFT JOIN users u2 ON p.assigned_to_id = u2.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1`,
        [rawProblem.id]
      );
      const problem = populatedResult.rows[0];

      // Log activity
      await client.query(
        `INSERT INTO problem_activity (problem_id, actor_id, action, new_value)
         VALUES ($1, $2, 'created', $3)`,
        [problem.id, request.user.id, problem.status]
      );

      await client.query('COMMIT');

      eventBus.publish('problem.identified', {
        entityType: 'problem',
        entityId: problem.id,
        actorId: request.user.id,
        data: { problem },
      });

      return reply.status(201).send({ data: problem });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // PATCH /problems/:id — update problem
  fastify.patch('/problems/:id', { preHandler: [fastify.requirePermission('manage_problems')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProblemSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current problem
      const current = await client.query('SELECT id, number, title, description, status, priority, root_cause, workaround, resolution, category_id, assigned_to_id, created_by_id, resolved_at, closed_at, tags, created_at, updated_at FROM problems WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Problem not found' });
      }

      const problem = current.rows[0];

      const updates: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (body.title !== undefined) { updates.push(`title = $${paramIdx++}`); params.push(body.title); }
      if (body.description !== undefined) { updates.push(`description = $${paramIdx++}`); params.push(body.description); }
      if (body.status !== undefined) { updates.push(`status = $${paramIdx++}`); params.push(body.status); }
      if (body.priority !== undefined) { updates.push(`priority = $${paramIdx++}`); params.push(body.priority); }
      if (body.root_cause !== undefined) { updates.push(`root_cause = $${paramIdx++}`); params.push(body.root_cause); }
      if (body.workaround !== undefined) { updates.push(`workaround = $${paramIdx++}`); params.push(body.workaround); }
      if (body.resolution !== undefined) { updates.push(`resolution = $${paramIdx++}`); params.push(body.resolution); }
      if (body.category_id !== undefined) { updates.push(`category_id = $${paramIdx++}`); params.push(body.category_id); }
      if (body.assigned_to_id !== undefined) { updates.push(`assigned_to_id = $${paramIdx++}`); params.push(body.assigned_to_id); }
      if (body.tags !== undefined) { updates.push(`tags = $${paramIdx++}`); params.push(body.tags); }
      if (body.status === 'resolved') { updates.push(`resolved_at = NOW()`); }
      if (body.status === 'closed') { updates.push(`closed_at = NOW()`); }
      // If reopening from resolved/closed, clear timestamps
      if (body.status && body.status !== 'resolved' && body.status !== 'closed') {
        if (body.status !== problem.status && (problem.status === 'resolved' || problem.status === 'closed')) {
          updates.push(`resolved_at = NULL`);
          updates.push(`closed_at = NULL`);
        }
      }

      if (updates.length === 0) {
        await client.query('COMMIT');
        return reply.send({ data: problem });
      }

      params.push(id);
      await client.query(
        `UPDATE problems SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
        params
      );

      // Log activity for status changes
      if (body.status && body.status !== problem.status) {
        await client.query(
          `INSERT INTO problem_activity (problem_id, actor_id, action, old_value, new_value)
           VALUES ($1, $2, 'status_changed', $3, $4)`,
          [id, request.user.id, problem.status, body.status]
        );
      }

      // Log activity for other field changes
      const trackedFields = ['title', 'description', 'priority', 'root_cause', 'workaround', 'resolution', 'assigned_to_id', 'category_id'];
      for (const field of trackedFields) {
        const bodyVal = (body as any)[field];
        if (bodyVal !== undefined && bodyVal !== (problem as any)[field]) {
          await client.query(
            `INSERT INTO problem_activity (problem_id, actor_id, action, old_value, new_value)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, request.user.id, field, String((problem as any)[field] ?? ''), String(bodyVal ?? '')]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated problem with joins
      const updatedResult = await pool.query(
        `SELECT p.*, 
          u1.name as created_by_name,
          u2.name as assigned_to_name, u2.avatar_url as assigned_to_avatar,
          c.name as category_name, c.color as category_color
         FROM problems p
         LEFT JOIN users u1 ON p.created_by_id = u1.id
         LEFT JOIN users u2 ON p.assigned_to_id = u2.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1`,
        [id]
      );

      const updatedProblem = updatedResult.rows[0];

      eventBus.publish('problem.updated', {
        entityType: 'problem',
        entityId: id,
        actorId: request.user.id,
        data: { problem: updatedProblem, previousData: { status: problem.status, priority: problem.priority } },
      });
      if (body.status === 'resolved') {
        eventBus.publish('problem.resolved', {
          entityType: 'problem',
          entityId: id,
          actorId: request.user.id,
          data: { problem: updatedProblem },
        });
      }

      return reply.send({ data: updatedProblem });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // DELETE /problems/:id — delete problem (admin only)
  fastify.delete('/problems/:id', { preHandler: [fastify.requirePermission('delete_problems')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM problems WHERE id = $1', [id]);
    return reply.status(204).send();
  });

  // ========== PROBLEM-INCIDENT LINKS ==========

  // POST /problems/:id/link-incident — link an incident to a problem
  fastify.post('/problems/:id/link-incident', { preHandler: [fastify.requirePermission('manage_problems')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = linkIncidentSchema.parse(request.body);

    // Verify problem exists
    const problemCheck = await pool.query('SELECT id FROM problems WHERE id = $1', [id]);
    if (problemCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Problem not found' });
    }

    // Verify incident exists
    const incidentCheck = await pool.query('SELECT id, number, title FROM tickets WHERE id = $1', [body.incident_id]);
    if (incidentCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    // Check for duplicate
    const dupCheck = await pool.query(
      'SELECT id FROM problem_incident_links WHERE problem_id = $1 AND incident_id = $2',
      [id, body.incident_id]
    );
    if (dupCheck.rows.length > 0) {
      return reply.status(409).send({ error: 'Incident is already linked to this problem' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO problem_incident_links (problem_id, incident_id, link_type, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, body.incident_id, body.link_type, request.user.id]
      );

      // Log activity
      await client.query(
        `INSERT INTO problem_activity (problem_id, actor_id, action, new_value)
         VALUES ($1, $2, 'incident_linked', $3)`,
        [id, request.user.id, `Linked incident #${incidentCheck.rows[0].number}: ${incidentCheck.rows[0].title}`]
      );

      await client.query('COMMIT');

      return reply.status(201).send({ data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // DELETE /problems/:id/link-incident/:incidentId — unlink incident
  fastify.delete('/problems/:id/link-incident/:incidentId', { preHandler: [fastify.requirePermission('delete_problems')] }, async (request, reply) => {
    const { id, incidentId } = request.params as { id: string; incidentId: string };

    const linkCheck = await pool.query(
      'SELECT id FROM problem_incident_links WHERE problem_id = $1 AND incident_id = $2',
      [id, incidentId]
    );
    if (linkCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Link not found' });
    }

    await pool.query(
      'DELETE FROM problem_incident_links WHERE problem_id = $1 AND incident_id = $2',
      [id, incidentId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO problem_activity (problem_id, actor_id, action, new_value)
       VALUES ($1, $2, 'incident_unlinked', $3)`,
      [id, request.user.id, `Unlinked incident ${incidentId}`]
    );

    return reply.send({ message: 'Incident unlinked' });
  });

  // ========== ACTIVITY ==========

  // POST /problems/:id/activity — add activity entry
  fastify.post('/problems/:id/activity', { preHandler: [fastify.requirePermission('manage_problems')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createActivitySchema.parse(request.body);

    // Verify problem exists
    const problemCheck = await pool.query('SELECT id FROM problems WHERE id = $1', [id]);
    if (problemCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Problem not found' });
    }

    const result = await pool.query(
      `INSERT INTO problem_activity (problem_id, actor_id, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, request.user.id, body.action, body.old_value || null, body.new_value || null]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });
}
