// email-accounts.ts — API routes for managing email accounts (SMTP/IMAP/Gmail API)

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { testEmailAccount, sanitizeAccount } from '../services/email-transport';

const createAccountSchema = z.object({
  name: z.string().min(1).max(200),
  account_type: z.enum(['smtp', 'imap', 'gmail_api']),
  direction: z.enum(['outbound', 'inbound', 'both']),
  host: z.string().max(500).optional().nullable(),
  port: z.number().int().optional().nullable(),
  encryption: z.enum(['none', 'ssl', 'tls', 'starttls']).optional().nullable(),
  username: z.string().max(500).optional().nullable(),
  password: z.string().optional().nullable(),
  email_address: z.string().max(500).optional().nullable(),
  from_name: z.string().max(200).optional().nullable(),
  imap_folder: z.string().max(200).optional().nullable(),
  imap_poll_interval: z.number().int().min(10).max(86400).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  is_default: z.boolean().optional().default(false),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  account_type: z.enum(['smtp', 'imap', 'gmail_api']).optional(),
  direction: z.enum(['outbound', 'inbound', 'both']).optional(),
  host: z.string().max(500).optional().nullable(),
  port: z.number().int().optional().nullable(),
  encryption: z.enum(['none', 'ssl', 'tls', 'starttls']).optional().nullable(),
  username: z.string().max(500).optional().nullable(),
  password: z.string().optional().nullable(),
  email_address: z.string().max(500).optional().nullable(),
  from_name: z.string().max(200).optional().nullable(),
  imap_folder: z.string().max(200).optional().nullable(),
  imap_poll_interval: z.number().int().min(10).max(86400).optional().nullable(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export default async function emailAccountRoutes(fastify: FastifyInstance) {

  // ─── GET /email-accounts — List all email accounts ─────────────────────
  fastify.get('/email-accounts', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const result = await pool.query(
      'SELECT * FROM email_accounts ORDER BY is_default DESC, created_at DESC'
    );
    return reply.send({ data: result.rows.map(sanitizeAccount) });
  });

  // ─── POST /email-accounts — Create a new email account ─────────────────
  fastify.post('/email-accounts', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const body = createAccountSchema.parse(request.body);

    // If setting as default, unset any existing default first
    if (body.is_default) {
      await pool.query(
        "UPDATE email_accounts SET is_default = false WHERE direction IN ('outbound', 'both') AND is_default = true"
      );
    }

    const result = await pool.query(
      `INSERT INTO email_accounts (name, account_type, direction, host, port, encryption, username, password, email_address, from_name, imap_folder, imap_poll_interval, is_active, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        body.name,
        body.account_type,
        body.direction,
        body.host ?? null,
        body.port ?? null,
        body.encryption ?? null,
        body.username ?? null,
        body.password ?? null,
        body.email_address ?? null,
        body.from_name ?? null,
        body.imap_folder ?? 'INBOX',
        body.imap_poll_interval ?? 60,
        body.is_active,
        body.is_default,
      ]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'create_email_account', 'email_accounts', result.rows[0].id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.status(201).send({ data: sanitizeAccount(result.rows[0]) });
  });

  // ─── PATCH /email-accounts/:id — Update an email account ──────────────
  fastify.patch('/email-accounts/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateAccountSchema.parse(request.body);

    // Check account exists
    const existing = await pool.query('SELECT * FROM email_accounts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Email account not found' });
    }

    // If setting as default, unset any existing default first
    if (body.is_default) {
      await pool.query(
        "UPDATE email_accounts SET is_default = false WHERE direction IN ('outbound', 'both') AND is_default = true AND id != $1",
        [id]
      );
    }

    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0) {
      return reply.send({ data: sanitizeAccount(existing.rows[0]) });
    }

    const setClauses = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const result = await pool.query(
      `UPDATE email_accounts SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'update_email_account', 'email_accounts', id, JSON.stringify(body)]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ data: sanitizeAccount(result.rows[0]) });
  });

  // ─── DELETE /email-accounts/:id — Delete an email account ─────────────
  fastify.delete('/email-accounts/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await pool.query('SELECT * FROM email_accounts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Email account not found' });
    }

    await pool.query('DELETE FROM email_accounts WHERE id = $1', [id]);

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'delete_email_account', 'email_accounts', id, JSON.stringify({ name: existing.rows[0].name })]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

  // ─── POST /email-accounts/:id/test — Test connection ──────────────────
  fastify.post('/email-accounts/:id/test', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await testEmailAccount(id);
    return reply.send({ data: result });
  });

  // ─── POST /email-accounts/:id/set-default — Set as default outbound ───
  fastify.post('/email-accounts/:id/set-default', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await pool.query('SELECT * FROM email_accounts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Email account not found' });
    }

    if (existing.rows[0].direction === 'inbound') {
      return reply.status(400).send({ error: 'Cannot set an inbound-only account as the default outbound account' });
    }

    // Unset all defaults, then set this one
    await pool.query(
      "UPDATE email_accounts SET is_default = false WHERE direction IN ('outbound', 'both') AND is_default = true"
    );
    await pool.query(
      'UPDATE email_accounts SET is_default = true WHERE id = $1',
      [id]
    );

    try {
      await pool.query(
        'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
        [request.user.id, 'set_default_email_account', 'email_accounts', id, JSON.stringify({ name: existing.rows[0].name })]
      );
    } catch (logErr: any) {
      fastify.log.error({ err: logErr }, 'Failed to write audit log');
    }

    return reply.send({ success: true });
  });

  // POST /email-accounts/:id/connect-oauth — Start OAuth flow for a specific email account
  fastify.post('/email-accounts/:id/connect-oauth', { preHandler: [fastify.requirePermission('manage_email_accounts')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const accountResult = await pool.query('SELECT * FROM email_accounts WHERE id = $1', [id]);
    if (accountResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Email account not found' });
    }

    const account = accountResult.rows[0];
    if (account.account_type !== 'gmail_api') {
      return reply.status(400).send({ error: 'OAuth is only supported for Gmail API accounts' });
    }

    // Load the OAuth client config
    const configResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'smtp_oauth_config'"
    );
    if (configResult.rows.length === 0) {
      return reply.status(400).send({ error: 'OAuth not configured. Set up client credentials first.' });
    }

    const config = JSON.parse(configResult.rows[0].value);
    if (!config.clientId || !config.clientSecret) {
      return reply.status(400).send({ error: 'Client ID and Client Secret are required' });
    }

    // Generate PKCE values
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(43).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = crypto.randomBytes(32).toString('hex');

    // Store state with account reference
    const { oauthStates } = await import('../routes/oauth');
    oauthStates.set(state, { 
      codeVerifier, 
      createdAt: Date.now(), 
      mode: 'email_send' as const, 
      provider: 'google' as const,
      accountId: id,
    });

    const host = (request as any).headers.host || 'localhost:3001';
    const protocol = (request as any).protocol || 'http';
    const redirectUri = `${protocol}://${host}/api/oauth/outbound/callback`;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
      ].join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
      login_hint: account.email_address || '',
    });

    const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return reply.send({ authorizeUrl });
  });
}
