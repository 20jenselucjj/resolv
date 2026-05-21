import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }
  
  return { blocked: record.count >= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - record.count) };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    record.count++;
  }
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(body.password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, name, role, avatar_url, created_at`,
      [body.email, body.name, passwordHash]
    );

    const user = result.rows[0];
    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name });

    return reply.status(201).send({ data: { user, token } });
  });

  fastify.post('/auth/login', async (request, reply) => {
    const ip = request.ip || 'unknown';
    const rateCheck = checkRateLimit(ip);
    if (rateCheck.blocked) {
      return reply.status(429).send({ error: 'Too many login attempts. Please try again in 15 minutes.' });
    }

    const body = loginSchema.parse(request.body);

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [body.email]
    );

    if (result.rows.length === 0) {
      recordFailedAttempt(ip);
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      recordFailedAttempt(ip);
      return reply.status(401).send({ error: 'Account is deactivated. Please contact your administrator.' });
    }

    const valid = await bcrypt.compare(body.password, user.password_hash);

    if (!valid) {
      recordFailedAttempt(ip);
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    clearAttempts(ip);

    return reply.send({
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatar_url },
        token,
      },
    });
  });

  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(
      'SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = $1',
      [(request.user as JwtPayload).id]
    );
    return reply.send({ data: result.rows[0] });
  });
}
