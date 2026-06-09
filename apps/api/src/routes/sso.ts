import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import ldap from 'ldapjs';
import { SAML } from 'passport-saml';
import type { SamlConfig, Profile } from 'passport-saml';
import { pool } from '../db/pool';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskCert(cert: string | null | undefined): string {
  if (!cert) return '';
  if (cert.length <= 20) return cert;
  return cert.substring(0, 10) + '…' + cert.substring(cert.length - 10);
}

function maskPassword(pw: string | null | undefined): string {
  if (!pw) return '';
  return '••••••••';
}

function sanitizeProvider(provider: any): any {
  if (!provider) return provider;
  const sanitized = { ...provider };
  delete sanitized.saml_cert;
  delete sanitized.ldap_bind_password;
  // Add masked copies for display
  sanitized.saml_cert_masked = provider.saml_cert ? maskCert(provider.saml_cert) : null;
  sanitized.ldap_bind_password_masked = provider.ldap_bind_password ? maskPassword(provider.ldap_bind_password) : null;
  return sanitized;
}

// ─── SAML Helpers ────────────────────────────────────────────────────────────

function createSamlInstance(provider: any): SAML {
  const config: any = {
    callbackUrl: provider.saml_callback_url,
    entryPoint: provider.saml_entry_point,
    issuer: provider.saml_issuer,
    cert: provider.saml_cert || '',
    wantAssertionsSigned: provider.saml_want_assertions_signed !== false,
    signatureAlgorithm: provider.saml_signature_algorithm || 'sha256',
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    acceptedClockSkewMs: 5000,
    validateInResponseTo: false,
  };
  return new SAML(config);
}

// ─── LDAP Login ──────────────────────────────────────────────────────────────

function ldapLogin(provider: any, username: string, password: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let client: ldap.Client | null = null;
    try {
      client = ldap.createClient({ url: provider.ldap_url });
    } catch (err: any) {
      return reject(new Error('Failed to connect to LDAP server: ' + (err.message || 'Unknown error')));
    }

    client.on('error', (err: any) => {
      // Don't reject here — the error event fires on connection errors but
      // the bind/search below will also fail. Suppress to avoid double-reject.
    });

    // Bind with service account
    client.bind(provider.ldap_bind_dn, provider.ldap_bind_password, (err) => {
      if (err) {
        try { client!.unbind(); } catch { /* ignore */ }
        return reject(new Error('LDAP bind failed: ' + (err.message || 'Unknown error')));
      }

      // Search for user
      const filter = (provider.ldap_search_filter || '(uid={{username}})').replace('{{username}}', username);
      client!.search(provider.ldap_search_base, { filter, scope: 'sub' }, (err, res) => {
        if (err) {
          try { client!.unbind(); } catch { /* ignore */ }
          return reject(new Error('LDAP search failed: ' + (err.message || 'Unknown error')));
        }

        let userEntry: any = null;
        let searchError: any = null;

        res.on('searchEntry', (entry) => {
          userEntry = entry.pojo;
        });

        res.on('error', (err) => {
          searchError = err;
        });

        res.on('end', () => {
          if (searchError) {
            try { client!.unbind(); } catch { /* ignore */ }
            return reject(new Error('LDAP search error: ' + (searchError.message || 'Unknown error')));
          }

          if (!userEntry) {
            try { client!.unbind(); } catch { /* ignore */ }
            return reject(new Error('User not found in LDAP directory'));
          }

          // Verify password by binding as user
          client!.bind(userEntry.objectName, password, (err) => {
            if (err) {
              try { client!.unbind(); } catch { /* ignore */ }
              return reject(new Error('Invalid credentials'));
            }

            // Extract attributes
            const attrs: Record<string, string> = {};
            if (userEntry.attributes) {
              for (const attr of userEntry.attributes) {
                if (attr.vals && attr.vals.length > 0) {
                  attrs[attr.type] = String(attr.vals[0] || '');
                }
              }
            }

            try { client!.unbind(); } catch { /* ignore */ }
            resolve({ dn: userEntry.objectName, attributes: attrs });
          });
        });
      });
    });
  });
}

// ─── Find or Create SSO User ────────────────────────────────────────────────

async function findOrCreateSsoUser(provider: any, attrs: Record<string, string>): Promise<any> {
  const mapping = provider.provider_type === 'saml'
    ? (provider.saml_attribute_mapping || {})
    : (provider.ldap_attribute_mapping || {});

  const email = attrs[mapping.email || 'email'];
  const name = attrs[mapping.name || 'name'] || email || 'User';

  if (!email) {
    throw new Error('Email attribute not found in SSO response');
  }

  // Check if user exists
  const existing = await pool.query(
    'SELECT id, email, name, role, avatar_url, is_active, locked, locked_until FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );

  if (existing.rows.length > 0) {
    const user = existing.rows[0];

    if (!user.is_active) {
      throw new Error('Account is deactivated. Please contact your administrator.');
    }

    // Auto-unlock if lock period has expired
    if (user.locked && user.locked_until) {
      if (new Date(user.locked_until) < new Date()) {
        await pool.query(
          'UPDATE users SET locked = false, locked_until = NULL, locked_by = NULL, locked_at = NULL, locked_reason = NULL, failed_login_attempts = 0 WHERE id = $1',
          [user.id]
        );
      } else {
        throw new Error('Account is locked. Please contact your administrator.');
      }
    }

    if (user.locked) {
      throw new Error('Account is locked. Please contact your administrator.');
    }

    // Update last login and source
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), name = $1, source = $2 WHERE id = $3',
      [name, provider.provider_type === 'saml' ? 'sso' : 'ldap', user.id]
    );

    return user;
  }

  // Auto-create if enabled
  if (!provider.auto_create_users) {
    throw new Error('User not found and auto-creation is disabled');
  }

  const result = await pool.query(
    `INSERT INTO users (email, name, password_hash, role, source, is_active)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
    [email, name, 'sso-no-password', provider.default_role || 'user', provider.provider_type === 'saml' ? 'sso' : 'ldap']
  );

  return result.rows[0];
}

// ─── Generate JWT + Refresh Token ────────────────────────────────────────────

async function generateAuthTokens(fastify: FastifyInstance, user: any) {
  const token = fastify.jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  }, { expiresIn: '24h' });

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  return { token, refreshToken };
}

// ─── Validation Schemas ──────────────────────────────────────────────────────

const createProviderSchema = z.object({
  name: z.string().min(1).max(200),
  provider_type: z.enum(['saml', 'ldap']),
  is_active: z.boolean().optional().default(true),
  // SAML fields
  saml_entry_point: z.string().optional(),
  saml_issuer: z.string().optional(),
  saml_callback_url: z.string().optional(),
  saml_cert: z.string().optional(),
  saml_want_assertions_signed: z.boolean().optional(),
  saml_want_authn_response_signed: z.boolean().optional(),
  saml_signature_algorithm: z.string().optional(),
  saml_attribute_mapping: z.record(z.string()).optional(),
  // LDAP fields
  ldap_url: z.string().optional(),
  ldap_bind_dn: z.string().optional(),
  ldap_bind_password: z.string().optional(),
  ldap_search_base: z.string().optional(),
  ldap_search_filter: z.string().optional(),
  ldap_attribute_mapping: z.record(z.string()).optional(),
  ldap_group_search_base: z.string().optional(),
  ldap_group_filter: z.string().optional(),
  ldap_group_role_mapping: z.record(z.any()).optional(),
  // Common
  auto_create_users: z.boolean().optional(),
  default_role: z.string().optional(),
});

const updateProviderSchema = createProviderSchema.partial();

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function ssoRoutes(fastify: FastifyInstance) {

  // ─── GET /sso/providers — List all SSO providers (admin only) ─────────────
  fastify.get('/sso/providers', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM sso_providers ORDER BY created_at DESC'
      );
      return reply.send({
        data: result.rows.map(sanitizeProvider),
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to load SSO providers' });
    }
  });

  // ─── GET /sso/providers/public — List active SSO providers (no auth) ──────
  fastify.get('/sso/providers/public', async (request, reply) => {
    try {
      const result = await pool.query(
        'SELECT id, name, provider_type, is_active FROM sso_providers WHERE is_active = true ORDER BY name ASC'
      );
      return reply.send({ data: result.rows });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to load SSO providers' });
    }
  });

  // ─── POST /sso/providers — Create SSO provider (admin only) ───────────────
  fastify.post('/sso/providers', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    try {
      const body = createProviderSchema.parse(request.body);

      const result = await pool.query(
        `INSERT INTO sso_providers (
          name, provider_type, is_active,
          saml_entry_point, saml_issuer, saml_callback_url, saml_cert,
          saml_want_assertions_signed, saml_want_authn_response_signed,
          saml_signature_algorithm, saml_attribute_mapping,
          ldap_url, ldap_bind_dn, ldap_bind_password, ldap_search_base,
          ldap_search_filter, ldap_attribute_mapping,
          ldap_group_search_base, ldap_group_filter, ldap_group_role_mapping,
          auto_create_users, default_role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          body.name, body.provider_type, body.is_active,
          body.saml_entry_point || null, body.saml_issuer || null,
          body.saml_callback_url || null, body.saml_cert || null,
          body.saml_want_assertions_signed ?? true,
          body.saml_want_authn_response_signed ?? true,
          body.saml_signature_algorithm || 'sha256',
          JSON.stringify(body.saml_attribute_mapping || { email: 'email', name: 'displayName', firstName: 'firstName', lastName: 'lastName' }),
          body.ldap_url || null, body.ldap_bind_dn || null,
          body.ldap_bind_password || null, body.ldap_search_base || null,
          body.ldap_search_filter || '(uid={{username}})',
          JSON.stringify(body.ldap_attribute_mapping || { email: 'mail', name: 'cn', firstName: 'givenName', lastName: 'sn', department: 'department' }),
          body.ldap_group_search_base || null, body.ldap_group_filter || null,
          JSON.stringify(body.ldap_group_role_mapping || {}),
          body.auto_create_users ?? true, body.default_role || 'user',
        ]
      );

      return reply.status(201).send({ data: sanitizeProvider(result.rows[0]) });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to create SSO provider' });
    }
  });

  // ─── PATCH /sso/providers/:id — Update SSO provider (admin only) ──────────
  fastify.patch('/sso/providers/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateProviderSchema.parse(request.body);

      const fields: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      const fieldMap: Record<string, any> = {
        name: body.name,
        provider_type: body.provider_type,
        is_active: body.is_active,
        saml_entry_point: body.saml_entry_point,
        saml_issuer: body.saml_issuer,
        saml_callback_url: body.saml_callback_url,
        saml_cert: body.saml_cert,
        saml_want_assertions_signed: body.saml_want_assertions_signed,
        saml_want_authn_response_signed: body.saml_want_authn_response_signed,
        saml_signature_algorithm: body.saml_signature_algorithm,
        ldap_url: body.ldap_url,
        ldap_bind_dn: body.ldap_bind_dn,
        ldap_bind_password: body.ldap_bind_password,
        ldap_search_base: body.ldap_search_base,
        ldap_search_filter: body.ldap_search_filter,
        ldap_group_search_base: body.ldap_group_search_base,
        ldap_group_filter: body.ldap_group_filter,
        auto_create_users: body.auto_create_users,
        default_role: body.default_role,
      };

      for (const [column, value] of Object.entries(fieldMap)) {
        if (value !== undefined) {
          fields.push(`${column} = $${paramIdx++}`);
          values.push(value);
        }
      }

      if (body.saml_attribute_mapping !== undefined) {
        fields.push(`saml_attribute_mapping = $${paramIdx++}`);
        values.push(JSON.stringify(body.saml_attribute_mapping));
      }
      if (body.ldap_attribute_mapping !== undefined) {
        fields.push(`ldap_attribute_mapping = $${paramIdx++}`);
        values.push(JSON.stringify(body.ldap_attribute_mapping));
      }
      if (body.ldap_group_role_mapping !== undefined) {
        fields.push(`ldap_group_role_mapping = $${paramIdx++}`);
        values.push(JSON.stringify(body.ldap_group_role_mapping));
      }

      if (fields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE sso_providers SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'SSO provider not found' });
      }

      try {
        await pool.query(
          'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data) VALUES ($1, $2, $3, $4, $5)',
          [request.user.id, 'update_sso_provider', 'sso_providers', id, JSON.stringify(body)]
        );
      } catch (logErr: any) {
        fastify.log.error({ err: logErr }, 'Failed to write audit log');
      }

      return reply.send({ data: sanitizeProvider(result.rows[0]) });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to update SSO provider' });
    }
  });

  // ─── DELETE /sso/providers/:id — Delete SSO provider (admin only) ─────────
  fastify.delete('/sso/providers/:id', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await pool.query(
        'DELETE FROM sso_providers WHERE id = $1 RETURNING id',
        [id]
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'SSO provider not found' });
      }

      try {
        await pool.query(
          'INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
          [request.user.id, 'delete_sso_provider', 'sso_providers', id]
        );
      } catch (logErr: any) {
        fastify.log.error({ err: logErr }, 'Failed to write audit log');
      }

      return reply.send({ success: true });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete SSO provider' });
    }
  });

  // ─── GET /sso/saml/login/:providerId — Initiate SAML login ────────────────
  fastify.get('/sso/saml/login/:providerId', async (request, reply) => {
    try {
      const { providerId } = request.params as { providerId: string };

      const result = await pool.query(
        'SELECT * FROM sso_providers WHERE id = $1 AND provider_type = $2 AND is_active = true',
        [providerId, 'saml']
      );

      if (result.rows.length === 0) {
        const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';
        return reply.redirect(`${frontendOrigin}/login?error=sso_not_configured`);
      }

      const provider = result.rows[0];

      // Build the callback URL based on request if not configured
      let callbackUrl = provider.saml_callback_url;
      if (!callbackUrl) {
        const host = request.headers.host || request.hostname;
        const protocol = request.protocol;
        callbackUrl = `${protocol}://${host}/api/sso/saml/callback`;
      }

      const saml = createSamlInstance({ ...provider, saml_callback_url: callbackUrl });

      const host = request.headers.host || request.hostname;
      const authUrl = await saml.getAuthorizeUrlAsync('', host, {} as any);
      return reply.redirect(authUrl);
    } catch (err: any) {
      fastify.log.error(err);
      const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendOrigin}/login?error=sso_error`);
    }
  });

  // ─── POST /sso/saml/callback — Handle SAML callback from IdP ──────────────
  fastify.post('/sso/saml/callback', async (request, reply) => {
    try {
      const body = request.body as Record<string, any>;
      const samlResponse = body.SAMLResponse;

      if (!samlResponse) {
        return reply.status(400).send({ error: 'Missing SAMLResponse' });
      }

      // Load all active SAML providers
      const providers = await pool.query(
        'SELECT * FROM sso_providers WHERE provider_type = $1 AND is_active = true ORDER BY created_at ASC',
        ['saml']
      );

      if (providers.rows.length === 0) {
        return reply.status(400).send({ error: 'No active SAML provider configured' });
      }

      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      const requestCallbackUrl = `${protocol}://${host}/api/sso/saml/callback`;

      let matchedUser: any = null;
      let lastError: any = null;

      for (const provider of providers.rows) {
        const callbackUrl = provider.saml_callback_url || requestCallbackUrl;

        try {
          const saml = createSamlInstance({ ...provider, saml_callback_url: callbackUrl });
          const result = await saml.validatePostResponseAsync(body);

          if (result.loggedOut) {
            continue;
          }

          const profile: any = result.profile || {};

          // Extract user attributes using attribute mapping
          const mapping = provider.saml_attribute_mapping || {};
          const attrs: Record<string, string> = {};

          // Map attributes from SAML profile using configured mapping
          const mappingObj = typeof mapping === 'object' ? mapping : {};
          for (const [mappedKey, profileKey] of Object.entries(mappingObj)) {
            const key = String(profileKey);
            const val = profile[key];
            if (val !== undefined && val !== null) {
              attrs[mappedKey] = String(val);
            }
          }

          // Try direct profile fields as fallbacks for critical attributes
          if (!attrs.email) attrs.email = profile.email || profile.mail || profile.nameID || '';
          if (!attrs.name) attrs.name = profile.displayName || profile.cn || profile.name || attrs.email;

          matchedUser = await findOrCreateSsoUser(provider, attrs);
          break;
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }

      if (!matchedUser) {
        fastify.log.error('SAML callback failed for all providers:', lastError);
        const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';
        return reply.redirect(`${frontendOrigin}/login?error=sso_auth_failed`);
      }

      // Generate JWT and refresh token
      const { token, refreshToken } = await generateAuthTokens(fastify, matchedUser);
      const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendOrigin}/login?token=${token}&refreshToken=${refreshToken}`);
    } catch (err: any) {
      fastify.log.error(err);
      const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendOrigin}/login?error=sso_error`);
    }
  });

  // ─── GET /sso/saml/metadata.xml — SP Metadata (no auth) ──────────────────
  fastify.get('/sso/saml/metadata.xml', async (request, reply) => {
    try {
      const providers = await pool.query(
        'SELECT * FROM sso_providers WHERE provider_type = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        ['saml']
      );

      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      const entityId = providers.rows.length > 0
        ? (providers.rows[0].saml_issuer || `${protocol}://${host}/api/sso/saml/metadata`)
        : `${protocol}://${host}/api/sso/saml/metadata`;
      const acsUrl = providers.rows.length > 0
        ? (providers.rows[0].saml_callback_url || `${protocol}://${host}/api/sso/saml/callback`)
        : `${protocol}://${host}/api/sso/saml/callback`;

      // Generate metadata XML manually for simplicity and broad compatibility
      const xml = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      AuthnRequestsSigned="true"
                      WantAssertionsSigned="true">
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${acsUrl}"
                                 index="0"/>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                                 Location="${acsUrl}"
                                 index="1"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

      return reply.type('application/xml').send(xml);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to generate metadata' });
    }
  });

  // ─── POST /sso/ldap/login — LDAP login ────────────────────────────────────
  const ldapLoginSchema = z.object({
    provider_id: z.string().uuid(),
    username: z.string().min(1),
    password: z.string().min(1),
  });

  fastify.post('/sso/ldap/login', async (request, reply) => {
    try {
      const body = ldapLoginSchema.parse(request.body);

      // Load provider
      const result = await pool.query(
        'SELECT * FROM sso_providers WHERE id = $1 AND provider_type = $2 AND is_active = true',
        [body.provider_id, 'ldap']
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'LDAP provider not found or inactive' });
      }

      const provider = result.rows[0];

      // Attempt LDAP login
      let ldapResult: any;
      try {
        ldapResult = await ldapLogin(provider, body.username, body.password);
      } catch (err: any) {
        const message = err.message || 'LDAP authentication failed';
        if (message === 'Invalid credentials') {
          return reply.status(401).send({ error: 'Invalid credentials' });
        }
        return reply.status(401).send({ error: message });
      }

      // Find or create user
      let user: any;
      try {
        user = await findOrCreateSsoUser(provider, ldapResult.attributes);
      } catch (err: any) {
        return reply.status(401).send({ error: err.message || 'Failed to find or create user' });
      }

      // Generate tokens
      const { token, refreshToken } = await generateAuthTokens(fastify, user);

      return reply.send({
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatar_url,
          },
          token,
          refreshToken,
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'LDAP login failed' });
    }
  });

  // ─── POST /sso/ldap/test — Test LDAP connection (admin only) ──────────────
  const ldapTestSchema = z.object({
    url: z.string().min(1),
    bind_dn: z.string().min(1),
    bind_password: z.string().min(1),
    search_base: z.string().min(1),
    search_filter: z.string().optional(),
  });

  fastify.post('/sso/ldap/test', { preHandler: [fastify.requirePermission('manage_settings')] }, async (request, reply) => {
    try {
      const body = ldapTestSchema.parse(request.body);

      const success = await new Promise<boolean>((resolve) => {
        let client: ldap.Client | null = null;
        try {
          client = ldap.createClient({ url: body.url });
        } catch {
          return resolve(false);
        }

        const timer = setTimeout(() => {
          try { client!.unbind(); } catch { /* ignore */ }
          resolve(false);
        }, 10000);

        client.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });

        client.bind(body.bind_dn, body.bind_password, (err) => {
          if (err) {
            clearTimeout(timer);
            try { client!.unbind(); } catch { /* ignore */ }
            return resolve(false);
          }

          const filter = body.search_filter || '(uid=*)';
          client!.search(body.search_base, { filter, scope: 'base', timeLimit: 5 }, (err, res) => {
            clearTimeout(timer);
            if (err) {
              try { client!.unbind(); } catch { /* ignore */ }
              return resolve(false);
            }

            let found = false;
            res.on('searchEntry', () => { found = true; });
            res.on('error', () => resolve(false));
            res.on('end', () => {
              try { client!.unbind(); } catch { /* ignore */ }
              resolve(found);
            });
          });
        });
      });

      if (success) {
        return reply.send({ success: true, message: 'LDAP connection successful' });
      } else {
        return reply.status(400).send({ success: false, error: 'LDAP connection failed. Check your settings.' });
      }
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'LDAP test failed' });
    }
  });
}
