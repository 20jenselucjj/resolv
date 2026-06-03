import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'agent', 'user']).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'agent', 'user']),
  department: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
});

export default async function userRoutes(fastify: FastifyInstance) {
  // 1. GET /users - List all users (authenticated)
  fastify.get('/users', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { search, role, is_active } = request.query as { search?: string; role?: string; is_active?: string };
    
    let query = `
      SELECT id, email, name, role, avatar_url, department, phone, is_active, last_login_at, created_at 
      FROM users 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    
    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, params);
    return reply.send({ data: result.rows });
  });

  // 2. GET /users/:id - Get single user with ticket stats
  fastify.get('/users/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const userResult = await pool.query(
      'SELECT id, email, name, role, avatar_url, department, phone, is_active, last_login_at, created_at FROM users WHERE id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }
    
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM tickets WHERE created_by_id = $1) as total_created,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to_id = $1) as total_assigned,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to_id = $1 AND status NOT IN ('resolved', 'closed')) as open_assigned
    `, [id]);
    
    const user = userResult.rows[0];
    user.stats = {
      total_created: parseInt(statsResult.rows[0].total_created, 10),
      total_assigned: parseInt(statsResult.rows[0].total_assigned, 10),
      open_assigned: parseInt(statsResult.rows[0].open_assigned, 10)
    };
    
    return reply.send({ data: user });
  });

  // 3. PATCH /users/:id - Update user profile
  fastify.patch('/users/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as JwtPayload;
    const body = userUpdateSchema.parse(request.body);
    
    const isAdmin = currentUser.role === 'admin';
    const isSelf = currentUser.id === id;
    
    if (!isAdmin && !isSelf) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    
    if (!isAdmin) {
      // Regular users can only update name, department, phone, avatar_url
      const allowedFields = ['name', 'department', 'phone', 'avatar_url'];
      const keys = Object.keys(body);
      const invalidFields = keys.filter(key => !allowedFields.includes(key));
      
      if (invalidFields.length > 0) {
        return reply.status(403).send({ error: `Regular users cannot update: ${invalidFields.join(', ')}` });
      }
    }

    const fields = Object.keys(body).filter(key => (body as any)[key] !== undefined);
    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map(field => (body as any)[field]);

    try {
      const result = await pool.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1 RETURNING id, email, name, role, avatar_url, department, phone, is_active, created_at`,
        [id, ...values]
      );
      
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [currentUser.id, 'update_user', 'users', id, JSON.stringify(body)]
      );

      return reply.send({ data: result.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Email already exists' });
      }
      throw err;
    }
  });

  // 4. POST /users/:id/change-password
  fastify.post('/users/:id/change-password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as JwtPayload;
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    
    const isAdmin = currentUser.role === 'admin';
    const isSelf = currentUser.id === id;
    
    if (!isAdmin && !isSelf) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    if (!isAdmin) {
      const userResult = await pool.query('SELECT password_hash, password_reset_required FROM users WHERE id = $1', [id]);
      if (userResult.rows.length === 0) return reply.status(404).send({ error: 'User not found' });
      
      // If password reset is required (temporary password), skip current password check
      if (!userResult.rows[0].password_reset_required) {
        if (!currentPassword) {
          return reply.status(400).send({ error: 'Current password is required' });
        }
        const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!valid) return reply.status(401).send({ error: 'Invalid current password' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, password_reset_required = false WHERE id = $2', [passwordHash, id]);
    
    return reply.send({ message: 'Password updated successfully' });
  });

  // POST /users/:id/reset-password - Admin only, generates temp password
  fastify.post('/users/:id/reset-password', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const tempPassword = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    
    const result = await pool.query('UPDATE users SET password_hash = $1, password_reset_required = true WHERE id = $2 RETURNING id', [passwordHash, id]);
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }
    
    return reply.send({ tempPassword });
  });

  // 5. DELETE /users/:id - Admin only (hard delete)
  fastify.delete('/users/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user as JwtPayload;
    
    // Prevent self-deletion
    if (currentUser.id === id) {
      return reply.status(400).send({ error: 'Cannot delete your own account' });
    }
    
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }
    
    return reply.send({ message: 'User deleted successfully' });
  });

  // 6. POST /users/invite - Admin only
  fastify.post('/users/invite', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { email, name, role, department } = inviteSchema.parse(request.body);
    const currentUser = request.user as JwtPayload;
    
    // Generate a 12-char random string
    const tempPassword = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    
    try {
      const result = await pool.query(
        `INSERT INTO users (email, name, password_hash, role, department, is_active, password_reset_required)
         VALUES ($1, $2, $3, $4, $5, true, true)
         RETURNING id, email, name, role, department, password_reset_required, created_at`,
        [email, name, passwordHash, role, department]
      );
      
      const newUser = result.rows[0];
      
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [currentUser.id, 'invite_user', 'users', newUser.id, JSON.stringify({ email, role, department })]
      );
      
      return reply.status(201).send({ data: { user: newUser, tempPassword } });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Email already exists' });
      }
      throw err;
    }
  });

  // 7. GET /users/:id/tickets
  fastify.get('/users/:id/tickets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, status } = request.query as { type?: 'created' | 'assigned'; status?: string };
    
    let query = 'SELECT * FROM tickets WHERE ';
    const params: any[] = [];
    
    if (type === 'assigned') {
      params.push(id);
      query += `assigned_to_id = $${params.length}`;
    } else {
      params.push(id);
      query += `created_by_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    return reply.send({ data: result.rows });
  });
}
