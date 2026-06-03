import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import https from 'https';
import { URL } from 'url';
import { pool } from '../db/pool';
import { JwtPayload } from '../plugins/auth';
import { oauthStates } from './oauth';
import { getLoginMode, getEmergencyKey, verifyEmergencyKey } from './directory-sync/helpers';

// Create refresh_tokens table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
`).catch(() => {});

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
  emergency_key: z.string().optional(),
  rememberMe: z.boolean().optional(),
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

    // Enforce login mode
    const loginMode = await getLoginMode();
    if (loginMode === 'password_only') {
      return reply.status(403).send({ error: 'Password login is disabled. Please use SSO to sign in.' });
    }
    if (loginMode === 'sso_only') {
      const emergencyKey = body.emergency_key;
      if (!emergencyKey) {
        return reply.status(403).send({ error: 'SSO-only mode is enabled. Please sign in with your organization account.' });
      }
      const isValid = await verifyEmergencyKey(emergencyKey);
      if (!isValid) {
        return reply.status(403).send({ error: 'SSO-only mode is enabled. The emergency bypass key is invalid.' });
      }
    }

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

    let refreshToken: string | undefined;
    if (body.rememberMe) {
      // Generate refresh token (valid for 30 days)
      refreshToken = crypto.randomBytes(40).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await pool.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, refreshToken, expiresAt]
      );
    }

    clearAttempts(ip);

    return reply.send({
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatar_url },
        token,
        refreshToken,
        passwordResetRequired: user.password_reset_required,
      },
    });
  });

  const refreshSchema = z.object({
    refreshToken: z.string(),
  });

  fastify.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    // Look up the refresh token
    const result = await pool.query(
      'SELECT rt.*, u.email, u.name, u.role, u.is_active FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = $1',
      [body.refreshToken]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    const tokenData = result.rows[0];

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [body.refreshToken]);
      return reply.status(401).send({ error: 'Refresh token expired' });
    }

    // Check if user is still active
    if (!tokenData.is_active) {
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [tokenData.user_id]);
      return reply.status(401).send({ error: 'Account is deactivated' });
    }

    // Issue new access token (short-lived: 24 hours)
    const newToken = fastify.jwt.sign({
      id: tokenData.user_id,
      email: tokenData.email,
      role: tokenData.role,
      name: tokenData.name,
    });

    return reply.send({
      data: {
        token: newToken,
        user: {
          id: tokenData.user_id,
          email: tokenData.email,
          name: tokenData.name,
          role: tokenData.role,
        },
      },
    });
  });

  fastify.post('/auth/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as JwtPayload).id;
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    return reply.send({ success: true });
  });

  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(
      'SELECT id, email, name, role, avatar_url, password_reset_required, created_at FROM users WHERE id = $1',
      [(request.user as JwtPayload).id]
    );
    const user = result.rows[0];
    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
        passwordResetRequired: user.password_reset_required,
        created_at: user.created_at,
      },
    });
  });

  // ─── Forgot Password ─────────────────────────────────────────────────────

  // In-memory store for password reset tokens
  // { token: { email, expiresAt } }
  const passwordResets = new Map<string, { email: string; expiresAt: number }>();

  // Clean up expired tokens every 15 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [token, record] of passwordResets) {
      if (now > record.expiresAt) {
        passwordResets.delete(token);
      }
    }
  }, 15 * 60 * 1000);

  fastify.post('/auth/forgot-password', async (request, reply) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(request.body);

      // Check if email exists (for internal logging only)
      const result = await pool.query('SELECT id, name FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      const userExists = result.rows.length > 0;

      if (userExists) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        passwordResets.set(token, { email: result.rows[0].email, expiresAt });

        const protocol = request.protocol;
        const host = request.headers.host || request.hostname;
        const resetLink = `${protocol}://${host}/reset-password?token=${token}`;
        fastify.log.info(`Password reset link for ${email}: ${resetLink}`);
        console.log(`\n🔐 PASSWORD RESET LINK (for ${email}):\n   ${resetLink}\n`);
      }

      // Always return the same message regardless of whether email exists
      return reply.send({ message: 'If that email exists, you\'ll receive a reset link shortly.' });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to process request.' });
    }
  });

  fastify.post('/auth/reset-password', async (request, reply) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(8),
      }).parse(request.body);

      // Validate token
      const resetRecord = passwordResets.get(token);
      if (!resetRecord) {
        return reply.status(400).send({ error: 'Invalid or expired reset token.' });
      }

      if (Date.now() > resetRecord.expiresAt) {
        passwordResets.delete(token);
        return reply.status(400).send({ error: 'Reset token has expired.' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);

      // Update user's password
      const result = await pool.query(
        'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING id',
        [passwordHash, resetRecord.email]
      );

      if (result.rowCount === 0) {
        return reply.status(400).send({ error: 'User not found.' });
      }

      // Delete token (consumed)
      passwordResets.delete(token);

      return reply.send({ message: 'Password has been reset successfully.' });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to reset password.' });
    }
  });

  // ─── OAuth / SSO Login Routes ──────────────────────────────────────────────

  function generateCodeVerifier(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const bytes = crypto.randomBytes(43);
    for (let i = 0; i < 43; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  function generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
  }

  /** Perform an HTTPS POST and return parsed JSON */
  async function httpsPost(url: string, body: Record<string, string>): Promise<any> {
    const parsed = new URL(url);
    const params = new URLSearchParams(body).toString();

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(params),
          },
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => (data += chunk.toString()));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(params);
      req.end();
    });
  }

  // ─── GET /auth/oauth/config ───────────────────────────────────────────────
  // Returns whether SSO/OAuth login is configured (read from directory_sync_config)
  fastify.get('/auth/oauth/config', async (request, reply) => {
    try {
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );

      if (configResult.rows.length === 0) {
        return reply.send({ data: { enabled: false, provider: null } });
      }

      let config: any;
      try {
        config = JSON.parse(configResult.rows[0].value);
      } catch {
        return reply.send({ data: { enabled: false, provider: null } });
      }

      const enabled = !!(config.clientId && config.sso_enabled !== false);

      // Get login mode settings
      const loginMode = await getLoginMode();
      const hasEmergencyKey = !!(await getEmergencyKey());

      return reply.send({
        data: {
          enabled,
          provider: enabled ? (config.provider || 'google_workspace') : null,
          provider_name: enabled ? (config.provider_name || 'SSO') : null,
          login_mode: loginMode,
          has_emergency_bypass: hasEmergencyKey,
        }
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.send({ data: { enabled: false, provider: null } });
    }
  });

  // ─── GET /auth/oauth/google/authorize ─────────────────────────────────────
  // Redirects user to Google OAuth for login (openid + email + profile scopes)
  // Uses the shared callback /api/oauth/google/callback (handles both sync + login)
  // Supports ?prompt=select_account for account switching
  fastify.get('/auth/oauth/google/authorize', async (request, reply) => {
    try {
      // Block SSO login if in password_only mode
      const loginMode = await getLoginMode();
      if (loginMode === 'password_only') {
        return reply.redirect(302, `${request.headers.origin || 'http://localhost:3000'}/login?error=sso_disabled`);
      }

      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );

      if (configResult.rows.length === 0) {
        return reply.redirect(302, `${request.headers.origin || 'http://localhost:3000'}/login?error=sso_not_configured`);
      }

      let config: any;
      try {
        config = JSON.parse(configResult.rows[0].value);
      } catch {
        return reply.redirect(302, `${request.headers.origin || 'http://localhost:3000'}/login?error=sso_config_error`);
      }

      const clientId = config.clientId;
      if (!clientId) {
        return reply.redirect(302, `${request.headers.origin || 'http://localhost:3000'}/login?error=sso_not_configured`);
      }

      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      // Use the SAME callback as directory sync OAuth (registered in Google Cloud Console)
      const redirectUri = `${protocol}://${host}/api/oauth/google/callback`;

      // Generate PKCE values
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = crypto.randomBytes(32).toString('hex');

      // Store state in the SHARED oauth store (from oauth.ts) with mode='login'
      oauthStates.set(state, { codeVerifier, createdAt: Date.now(), mode: 'login', provider: 'google' });

      // Build Google OAuth URL (user login scopes only, no admin scopes)
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
      });

      // Support prompt=select_account for switching Google accounts
      const queryPrompt = (request.query as any)?.prompt;
      if (queryPrompt === 'select_account') {
        params.set('prompt', 'select_account');
      }

      const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return reply.redirect(302, authorizeUrl);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.redirect(302, `${request.headers.origin || 'http://localhost:3000'}/login?error=sso_error`);
    }
  });
}
