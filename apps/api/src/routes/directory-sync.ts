import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';
import { pool } from '../db/pool';
import { getStoredTokens, storeTokens, clearTokens, httpsPost, httpsGet } from './oauth';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const configSchema = z.object({
  enabled: z.boolean().optional().default(false),
  autoProvision: z.boolean().optional().default(false),
  defaultRole: z.enum(['admin', 'agent', 'user']).optional().default('user'),
  syncIntervalMinutes: z.number().int().min(1).optional().default(60),
  fieldMapping: z.record(z.string()).optional().default({
    name: 'name.fullName',
    email: 'primaryEmail',
    department: 'department',
    job_title: 'title',
    phone: 'phones[0].value',
    external_id: 'id',
  }),
  roleMapping: z.array(z.object({
    directoryGroup: z.string(),
    role: z.enum(['admin', 'agent', 'user']),
  })).optional().default([]),
  provider: z.enum(['google_workspace', 'azure_ad', 'okta', 'onelogin', 'generic']).optional().default('google_workspace'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tenantId: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  oauthConnected: z.boolean().optional(),
  oauthProvider: z.string().optional().nullable(),
  oauthDomain: z.string().optional().nullable(),
  oauthEmail: z.string().optional().nullable(),
  tokenExpiresAt: z.string().optional().nullable(),
});

const testConnectionSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  domain: z.string().optional().nullable(),
});

// ─── In-memory sync status ───────────────────────────────────────────────────

interface SyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'in_progress' | 'success' | 'error';
  usersSynced: number;
  usersCreated: number;
  usersUpdated: number;
  usersDeactivated: number;
  lastError: string | null;
  nextSyncAt: string | null;
}

let syncStatus: SyncStatus = {
  lastSyncAt: null,
  status: 'idle',
  usersSynced: 0,
  usersCreated: 0,
  usersUpdated: 0,
  usersDeactivated: 0,
  lastError: null,
  nextSyncAt: null,
};

// ─── Table creation ──────────────────────────────────────────────────────────

export async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id SERIAL PRIMARY KEY,
      state VARCHAR(255) UNIQUE NOT NULL,
      code_verifier VARCHAR(255) NOT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'google_workspace',
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes')
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP,
      status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
      users_synced INTEGER DEFAULT 0,
      users_created INTEGER DEFAULT 0,
      users_updated INTEGER DEFAULT 0,
      users_deactivated INTEGER DEFAULT 0,
      error TEXT
    );
  `);
}

// ─── Token refresh helper ────────────────────────────────────────────────────

async function getValidAccessToken(): Promise<string> {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('OAuth not connected. No tokens found.');
  }

  // Check if access token is still valid (with 5 min buffer)
  const expiryTime = new Date(tokens.expiryDate).getTime();
  if (Date.now() < expiryTime - 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  // Refresh the token
  const configResult = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
  );
  if (configResult.rows.length === 0) {
    throw new Error('Directory sync not configured.');
  }

  let config: any;
  try {
    config = JSON.parse(configResult.rows[0].value);
  } catch {
    throw new Error('Invalid directory sync configuration.');
  }

  const clientId = config.clientId;
  const clientSecret = config.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error('OAuth client credentials not configured.');
  }

  const tokenResponse = await httpsPost('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: 'refresh_token',
  });

  if (tokenResponse.error) {
    throw new Error(`Token refresh failed: ${tokenResponse.error_description || tokenResponse.error}`);
  }

    const newAccessToken = tokenResponse.access_token;
    const expiryDate = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000).toISOString();
    const newRefreshToken = tokenResponse.refresh_token || tokens.refreshToken;

    // Update stored tokens
    await storeTokens(newAccessToken, newRefreshToken, expiryDate);

  return newAccessToken;
}

// ─── Log sync to DB ──────────────────────────────────────────────────────────

async function logSync(
  status: string,
  usersSynced: number,
  usersCreated: number,
  usersUpdated: number,
  usersDeactivated: number,
  error?: string,
  syncId?: number,
): Promise<void> {
  if (syncId) {
    await pool.query(
      `UPDATE sync_logs SET
        completed_at = NOW(),
        status = $1,
        users_synced = $2,
        users_created = $3,
        users_updated = $4,
        users_deactivated = $5,
        error = $6
       WHERE id = $7`,
      [status, usersSynced, usersCreated, usersUpdated, usersDeactivated, error ?? null, syncId]
    );
  } else {
    await pool.query(
      `INSERT INTO sync_logs (status, users_synced, users_created, users_updated, users_deactivated, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [status, usersSynced, usersCreated, usersUpdated, usersDeactivated, error ?? null]
    );
  }
}

// ─── Fetch directory users from Google Admin SDK ─────────────────────────────

async function fetchGoogleDirectoryUsers(accessToken: string): Promise<any[]> {
  let allUsers: any[] = [];
  let pageToken: string | undefined;
  const maxResults = 500;

  do {
    let url = `https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=${maxResults}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await httpsGet(url, accessToken);

    if (response.error) {
      throw new Error(`Google Directory API error: ${response.error.message || JSON.stringify(response.error)}`);
    }

    if (response.users) {
      allUsers = allUsers.concat(response.users);
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return allUsers;
}

// ─── Fetch a single directory user by email ──────────────────────────────────

async function fetchGoogleDirectoryUser(accessToken: string, email: string): Promise<any> {
  const url = `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}`;
  const response = await httpsGet(url, accessToken);

  if (response.error) {
    // If the user doesn't exist, Google returns a 404
    if (response.error.code === 404 || response.error.message?.includes('not found')) {
      return null;
    }
    throw new Error(`Google Directory API error (user ${email}): ${response.error.message || JSON.stringify(response.error)}`);
  }

  return response;
}

// ─── Search directory users by name or email ─────────────────────────────────

async function searchGoogleDirectoryUsers(accessToken: string, query: string): Promise<any[]> {
  // Build query string for Google Directory API
  // Support searching by email or name
  const encodedQuery = encodeURIComponent(query);
  const url = `https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=20&query=${encodedQuery}`;
  
  const response = await httpsGet(url, accessToken);

  if (response.error) {
    throw new Error(`Google Directory API search error: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return response.users || [];
}

// ─── Fetch directory groups from Google Admin SDK ────────────────────────────

async function fetchGoogleDirectoryGroups(accessToken: string): Promise<any[]> {
  let allGroups: any[] = [];
  let pageToken: string | undefined;

  do {
    let url = 'https://admin.googleapis.com/admin/directory/v1/groups?customer=my_customer';
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await httpsGet(url, accessToken);

    if (response.error) {
      throw new Error(`Google Directory API error (groups): ${response.error.message || JSON.stringify(response.error)}`);
    }

    if (response.groups) {
      allGroups = allGroups.concat(response.groups);
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return allGroups;
}

// ─── Fetch members of a specific group ───────────────────────────────────────

async function fetchGroupMembers(accessToken: string, groupKey: string): Promise<string[]> {
  const members: string[] = [];
  let pageToken: string | undefined;

  do {
    let url = `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupKey)}/members?maxResults=200`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await httpsGet(url, accessToken);

    if (response.error) {
      // If we can't fetch members, silently skip
      return members;
    }

    if (response.members) {
      response.members.forEach((m: any) => {
        if (m.email) members.push(m.email.toLowerCase());
      });
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return members;
}

// ─── Resolve field value using dot/bracket notation ──────────────────────────

function resolveFieldPath(obj: any, path: string): any {
  if (!path) return undefined;

  // Handle array paths like "phones[0].value"
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

// ─── Apply field mapping to a directory user ─────────────────────────────────

function mapDirectoryUser(dirUser: any, fieldMapping: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};

  for (const [localField, dirPath] of Object.entries(fieldMapping)) {
    const value = resolveFieldPath(dirUser, dirPath);
    if (value !== undefined) {
      mapped[localField] = value;
    }
  }

  return mapped;
}

// ─── Friendly error mapping ───────────────────────────────────────────────────

const FRIENDLY_ERRORS: Record<string, string> = {
  invalid_client: 'The Client ID or Client Secret is incorrect. Double-check them in Google Cloud Console → APIs & Services → Credentials.',
  unauthorized_client: 'This OAuth client is not authorized for Google Workspace Admin SDK. Enable the Admin SDK API in Google Cloud Console.',
  access_denied: 'Access denied. Make sure you have Google Works Admin privileges and the Admin SDK API is enabled.',
  invalid_grant: 'The authorization grant is invalid. Try reconnecting OAuth.',
  'Token has expired': 'The OAuth token has expired. Re-authenticate to restore sync.',
  'Invalid Credentials': 'The stored OAuth credentials are invalid. Disconnect and reconnect OAuth.',
  'Not authorized to access this resource/api': 'The OAuth token lacks the required scopes. Reconnect OAuth with the correct permissions.',
  'insufficientPermissions': 'The connected account does not have Admin SDK privileges. Sign in with a Google Workspace super admin account.',
  'domainNotFound': 'The Google Workspace domain was not found. Verify the domain is correct and has active Google Workspace accounts.',
  'domainCannotUseApis': 'The domain does not have the Admin SDK API enabled. Enable it in Google Cloud Console.',
};

function friendlyError(error: string): string {
  for (const [key, friendly] of Object.entries(FRIENDLY_ERRORS)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return friendly;
    }
  }
  // For Google API errors with a code and message
  try {
    const parsed = JSON.parse(error);
    if (parsed.message) {
      for (const [key, friendly] of Object.entries(FRIENDLY_ERRORS)) {
        if (parsed.message.toLowerCase().includes(key.toLowerCase())) {
          return friendly;
        }
      }
    }
  } catch { /* not JSON, use original */ }
  return error;
}

// ─── Login Mode Helpers (exported for use by auth.ts) ─────────────────────────

const LOGIN_MODE_KEY = 'login_mode';
const EMERGENCY_KEY_KEY = 'login_emergency_key';

export async function getLoginMode(): Promise<string> {
  const result = await pool.query("SELECT value FROM system_settings WHERE key = $1", [LOGIN_MODE_KEY]);
  if (result.rows.length === 0) return 'both';
  const val = result.rows[0].value;
  return ['both', 'sso_only', 'password_only'].includes(val) ? val : 'both';
}

export async function getEmergencyKey(): Promise<string | null> {
  const result = await pool.query("SELECT value FROM system_settings WHERE key = $1", [EMERGENCY_KEY_KEY]);
  return result.rows.length > 0 ? result.rows[0].value : null;
}

export async function verifyEmergencyKey(key: string): Promise<boolean> {
  const stored = await getEmergencyKey();
  if (!stored) return false;
  // Use timing-safe comparison
  const storedBuf = Buffer.from(stored);
  const givenBuf = Buffer.from(key);
  if (storedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, givenBuf);
}

// ─── Frontend origin ─────────────────────────────────────────────────────────

const FRONTEND_ORIGIN = process.env.WEB_URL || 'http://localhost:3000';

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function directorySyncRoutes(fastify: FastifyInstance) {
  // Ensure tables exist on startup
  await ensureTables();

  // POST /admin/directory-sync/config
  fastify.post('/admin/directory-sync/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const body = configSchema.parse(request.body);

      // Protect the real clientSecret from being overwritten by the redacted
      // placeholder '********' that the frontend received via GET.
      // If the incoming secret is the placeholder, keep the existing one.
      if (body.clientSecret === '********') {
        const existing = await pool.query(
          "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
        );
        if (existing.rows.length > 0) {
          try {
            const existingConfig = JSON.parse(existing.rows[0].value);
            if (existingConfig.clientSecret && existingConfig.clientSecret !== '********') {
              body.clientSecret = existingConfig.clientSecret;
            }
          } catch { /* use the placeholder as-is if we can't parse */ }
        }
      }

      // Store config
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('directory_sync_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(body)]
      );

      return reply.send({ data: body, message: 'Directory sync configuration saved.' });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to save configuration.' });
    }
  });

  // GET /admin/directory-sync/config
  fastify.get('/admin/directory-sync/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const result = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );

      if (result.rows.length === 0) {
        return reply.send({ data: null });
      }

      let config: any;
      try {
        config = JSON.parse(result.rows[0].value);
      } catch {
        return reply.status(500).send({ error: 'Stored config is corrupted.' });
      }

      // Check if the stored secret is literally the placeholder (corrupted by a previous save bug)
      const secretCorrupted = config.clientSecret === '********';

      // Redact secret
      if (config.clientSecret) {
        config.clientSecret = '********';
      }

      // Signal to the frontend that the secret needs to be re-entered
      config.secretCorrupted = secretCorrupted;

      // Backwards compatibility: map old 'connected' field to 'oauthConnected'
      if (config.connected !== undefined && config.oauthConnected === undefined) {
        config.oauthConnected = config.connected;
      }

      // Backwards compatibility: convert old roleMapping (Record) to new format (array)
      if (config.roleMapping && !Array.isArray(config.roleMapping)) {
        const oldMapping = config.roleMapping as Record<string, string>;
        config.roleMapping = Object.entries(oldMapping).map(([directoryGroup, role]) => ({
          directoryGroup,
          role,
        }));
      }

      return reply.send({ data: config });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch configuration.' });
    }
  });

  // POST /admin/directory-sync/sync
  fastify.post('/admin/directory-sync/sync', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const syncId = await pool.query(
      `INSERT INTO sync_logs (started_at, status) VALUES (NOW(), 'in_progress') RETURNING id`
    ).then(r => r.rows[0].id);

    syncStatus.status = 'in_progress';

    try {
      // Get stored config
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );
      if (configResult.rows.length === 0) {
        throw new Error('Directory sync not configured.');
      }

      const config = JSON.parse(configResult.rows[0].value);
      const fieldMapping: Record<string, string> = config.fieldMapping || {};
      const roleMapping: Array<{ directoryGroup: string; role: string }> = config.roleMapping || [];
      const autoProvision = config.autoProvision || false;
      const defaultRole = config.defaultRole || 'user';

      // Get valid access token
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken();
      } catch (err: any) {
        if (err.message?.includes('OAuth not connected') || err.message?.includes('No tokens found')) {
          return reply.status(400).send({ error: 'Connect OAuth first' });
        }
        throw err;
      }

      // Fetch directory users
      const dirUsers = await fetchGoogleDirectoryUsers(accessToken);

      // Fetch groups for role mapping
      let groupMembersByEmail: Record<string, string[]> = {};
      if (roleMapping.length > 0) {
        const groupEmails = roleMapping.map(r => r.directoryGroup).filter(Boolean);
        const groups = await fetchGoogleDirectoryGroups(accessToken);
        for (const group of groups) {
          if (groupEmails.includes(group.email)) {
            const members = await fetchGroupMembers(accessToken, group.email);
            groupMembersByEmail[group.email] = members;
          }
        }
      }

      // Process users
      let usersSynced = 0;
      let usersCreated = 0;
      let usersUpdated = 0;
      let usersDeactivated = 0;

      const syncedEmails: string[] = [];

      for (const dirUser of dirUsers) {
        const mapped = mapDirectoryUser(dirUser, fieldMapping);
        const email = mapped.email || dirUser.primaryEmail;

        if (!email) continue;

        syncedEmails.push(email.toLowerCase());

        // Check if user exists
        const existing = await pool.query(
          'SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)',
          [email]
        );

        // Determine role from role mapping
        let role = defaultRole;
        for (const mapping of roleMapping) {
          if (mapping.directoryGroup && groupMembersByEmail[mapping.directoryGroup]?.includes(email.toLowerCase())) {
            role = mapping.role;
            break;
          }
        }

        if (existing.rows.length > 0) {
          // Update existing user
          const updateFields: string[] = [];
          const updateValues: any[] = [];
          let paramIdx = 1;

          if (mapped.name !== undefined) {
            updateFields.push(`name = $${paramIdx++}`);
            updateValues.push(mapped.name);
          }
          if (mapped.department !== undefined) {
            updateFields.push(`department = $${paramIdx++}`);
            updateValues.push(mapped.department);
          }
          if (mapped.job_title !== undefined) {
            updateFields.push(`title = $${paramIdx++}`);
            updateValues.push(mapped.job_title);
          }
          if (mapped.phone !== undefined) {
            updateFields.push(`phone = $${paramIdx++}`);
            updateValues.push(mapped.phone);
          }
          if (mapped.external_id !== undefined) {
            updateFields.push(`external_id = $${paramIdx++}`);
            updateValues.push(mapped.external_id);
          }

          updateFields.push('source = $' + paramIdx++);
          updateValues.push('google_workspace');
          updateFields.push('last_sync_at = NOW()');
          updateFields.push('is_active = true');

          if (role !== existing.rows[0].role) {
            updateFields.push(`role = $${paramIdx++}`);
            updateValues.push(role);
          }

          if (updateFields.length > 0) {
            updateValues.push(existing.rows[0].id);
            await pool.query(
              `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIdx}`,
              updateValues
            );
            usersUpdated++;
          }
        } else if (autoProvision) {
          // Create new user (existence already checked above)
          try {
            await pool.query(
              `INSERT INTO users (email, name, role, department, title, phone, external_id, source, is_active, last_sync_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'google_workspace', true, NOW())`,
              [
                email,
                mapped.name || email.split('@')[0],
                role,
                mapped.department ?? null,
                mapped.job_title ?? null,
                mapped.phone ?? null,
                mapped.external_id ?? null,
              ]
            );
            usersCreated++;
          } catch (insertErr: any) {
            // Ignore duplicate key errors in case of race condition
            if (insertErr.code !== '23505') throw insertErr;
          }
        }

        usersSynced++;
      }

      // Deactivate users not found in directory but with source='google_workspace'
      if (syncedEmails.length > 0) {
        // Build parameterized query to find users to deactivate
        const placeholders = syncedEmails.map((_, i) => `$${i + 1}`).join(',');
        const deactivateResult = await pool.query(
          `UPDATE users SET is_active = false
           WHERE source = 'google_workspace'
             AND is_active = true
             AND LOWER(email) NOT IN (${placeholders})
             AND last_sync_at IS NOT NULL
           RETURNING id`,
          [...syncedEmails]
        );
        usersDeactivated = deactivateResult.rowCount || 0;
      }

      // Mark sync as complete
      const completedAt = new Date().toISOString();
      syncStatus = {
        lastSyncAt: completedAt,
        status: 'success',
        usersSynced,
        usersCreated,
        usersUpdated,
        usersDeactivated,
        lastError: null,
        nextSyncAt: new Date(Date.now() + (config.syncIntervalMinutes || 60) * 60 * 1000).toISOString(),
      };

      await logSync('success', usersSynced, usersCreated, usersUpdated, usersDeactivated, undefined, syncId);

      return reply.send({ data: syncStatus });
    } catch (err: any) {
      const msg = err.message || 'Unknown error';
      const friendly = friendlyError(msg);
      fastify.log.error(err);

      syncStatus = {
        ...syncStatus,
        status: 'error',
        lastError: friendly,
      };

      await logSync('error', 0, 0, 0, 0, friendly, syncId);

      // If it's an OAuth-related error, surface that
      if (msg.includes('OAuth') || msg.includes('token') || msg.includes('oauth')) {
        return reply.status(400).send({ error: friendly });
      }

      return reply.status(500).send({ error: friendly });
    }
  });

  // POST /admin/directory-sync/sync-users
  const syncUsersSchema = z.object({
    emails: z.array(z.string().email()).min(1).max(20),
  });

  fastify.post('/admin/directory-sync/sync-users', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const { emails } = syncUsersSchema.parse(request.body);

      // Get stored config
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );
      if (configResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Directory sync not configured.' });
      }

      const config = JSON.parse(configResult.rows[0].value);
      const fieldMapping: Record<string, string> = config.fieldMapping || {};
      const roleMapping: Array<{ directoryGroup: string; role: string }> = config.roleMapping || [];
      const autoProvision = config.autoProvision || false;
      const defaultRole = config.defaultRole || 'user';

      // Get valid access token
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken();
      } catch (err: any) {
        if (err.message?.includes('OAuth not connected') || err.message?.includes('No tokens found')) {
          return reply.status(400).send({ error: 'Connect OAuth first' });
        }
        throw err;
      }

      // Fetch each user from the Directory API in parallel (up to 5 at a time)
      const results: Array<{ email: string; status: string; name?: string; error?: string }> = [];

      const concurrency = 5;
      for (let i = 0; i < emails.length; i += concurrency) {
        const batch = emails.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (email) => {
            try {
              const dirUser = await fetchGoogleDirectoryUser(accessToken, email);
              if (!dirUser) {
                return { email, status: 'not_found', error: 'User not found in Google Directory' };
              }

              // Map directory fields
              const mapped = mapDirectoryUser(dirUser, fieldMapping);
              const resolvedEmail = mapped.email || dirUser.primaryEmail;
              if (!resolvedEmail) {
                return { email, status: 'error', error: 'No email found in directory user record' };
              }

              // Check if user exists locally
              const existing = await pool.query(
                'SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)',
                [resolvedEmail]
              );

              // Determine role from role mapping
              let role = defaultRole;

              if (existing.rows.length > 0) {
                // Update existing user
                const updateFields: string[] = [];
                const updateValues: any[] = [];
                let paramIdx = 1;

                if (mapped.name !== undefined) {
                  updateFields.push(`name = $${paramIdx++}`);
                  updateValues.push(mapped.name);
                }
                if (mapped.department !== undefined) {
                  updateFields.push(`department = $${paramIdx++}`);
                  updateValues.push(mapped.department);
                }
                if (mapped.job_title !== undefined) {
                  updateFields.push(`title = $${paramIdx++}`);
                  updateValues.push(mapped.job_title);
                }
                if (mapped.phone !== undefined) {
                  updateFields.push(`phone = $${paramIdx++}`);
                  updateValues.push(mapped.phone);
                }
                if (mapped.external_id !== undefined) {
                  updateFields.push(`external_id = $${paramIdx++}`);
                  updateValues.push(mapped.external_id);
                }

                updateFields.push('source = $' + paramIdx++);
                updateValues.push('google_workspace');
                updateFields.push('last_sync_at = NOW()');
                updateFields.push('is_active = true');

                if (role !== existing.rows[0].role) {
                  updateFields.push(`role = $${paramIdx++}`);
                  updateValues.push(role);
                }

                if (updateFields.length > 0) {
                  updateValues.push(existing.rows[0].id);
                  await pool.query(
                    `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIdx}`,
                    updateValues
                  );
                }

                return { email: resolvedEmail, status: 'updated', name: mapped.name || resolvedEmail };
              } else if (autoProvision) {
                // Create new user
                try {
                  await pool.query(
                    `INSERT INTO users (email, name, role, department, title, phone, external_id, source, is_active, last_sync_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'google_workspace', true, NOW())`,
                    [
                      resolvedEmail,
                      mapped.name || resolvedEmail.split('@')[0],
                      role,
                      mapped.department ?? null,
                      mapped.job_title ?? null,
                      mapped.phone ?? null,
                      mapped.external_id ?? null,
                    ]
                  );
                  return { email: resolvedEmail, status: 'created', name: mapped.name || resolvedEmail };
                } catch (insertErr: any) {
                  if (insertErr.code === '23505') {
                    return { email: resolvedEmail, status: 'skipped', error: 'Duplicate email (race condition)' };
                  }
                  throw insertErr;
                }
              } else {
                return { email: resolvedEmail, status: 'skipped', error: 'Auto-provision is disabled. User does not exist locally.' };
              }
            } catch (err: any) {
              return { email, status: 'error', error: err.message || 'Unknown error' };
            }
          })
        );
        results.push(...batchResults);
      }

      return reply.send({
        data: {
          total: results.length,
          created: results.filter(r => r.status === 'created').length,
          updated: results.filter(r => r.status === 'updated').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          notFound: results.filter(r => r.status === 'not_found').length,
          errors: results.filter(r => r.status === 'error').length,
          results,
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: `Sync users failed: ${friendlyError(err.message)}` });
    }
  });

  // POST /admin/directory-sync/search-users
  fastify.post('/admin/directory-sync/search-users', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const body = request.body as { query?: string };
      const query = body.query?.trim();

      if (!query || query.length < 2) {
        return reply.status(400).send({ error: 'Query must be at least 2 characters' });
      }

      // Get valid access token
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken();
      } catch (err: any) {
        if (err.message?.includes('OAuth not connected') || err.message?.includes('No tokens found')) {
          return reply.status(400).send({ error: 'Connect OAuth first' });
        }
        throw err;
      }

      // Search users in Google Directory
      const users = await searchGoogleDirectoryUsers(accessToken, query);

      // Map to simple { email, name } objects
      const results = users.map((u: any) => ({
        email: u.primaryEmail || u.emails?.[0]?.address || '',
        name: u.name?.fullName || u.name?.givenName || '',
      })).filter((u: any) => u.email); // Only return users with email

      return reply.send({ data: results });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: `Search users failed: ${friendlyError(err.message)}` });
    }
  });

  // GET /admin/directory-sync/status
  fastify.get('/admin/directory-sync/status', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    return reply.send({ data: syncStatus });
  });

  // GET /admin/directory-sync/logs
  fastify.get('/admin/directory-sync/logs', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 20'
      );
      return reply.send({ data: result.rows });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch sync logs.' });
    }
  });

  // POST /admin/directory-sync/validate
  fastify.post('/admin/directory-sync/validate', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken();
      } catch (err: any) {
        if (err.message?.includes('OAuth not connected') || err.message?.includes('No tokens found')) {
          return reply.status(400).send({ error: 'Connect OAuth first' });
        }
        throw err;
      }

      // Test fetching 1 user from directory
      const response = await httpsGet(
        'https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=1',
        accessToken
      );

      if (response.error) {
        return reply.status(400).send({
          error: `Connection test failed: ${response.error.message || JSON.stringify(response.error)}`,
        });
      }

      return reply.send({
        data: {
          success: true,
          message: 'Connection validated successfully.',
          userCount: response.users?.length || 0,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: `Validation failed: ${err.message}` });
    }
  });

  // ─── Login Mode ──────────────────────────────────────────────────────────────
  // Values: 'both' (default), 'sso_only', 'password_only'

  // GET /admin/login-mode
  fastify.get('/admin/login-mode', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const mode = await getLoginMode();
      const emergencyKey = await getEmergencyKey();
      return reply.send({
        data: {
          mode,
          hasEmergencyKey: !!emergencyKey,
          emergencyKey, // Only returned to admins
          loginUrl: emergencyKey
            ? `${FRONTEND_ORIGIN}/login?emergency=${emergencyKey}`
            : null,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to get login mode.' });
    }
  });

  // POST /admin/login-mode
  const loginModeSchema = z.object({
    mode: z.enum(['both', 'sso_only', 'password_only']),
  });

  fastify.post('/admin/login-mode', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const { mode } = loginModeSchema.parse(request.body);

      // Save mode
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [LOGIN_MODE_KEY, mode]
      );

      // Auto-generate emergency key when switching to sso_only
      if (mode === 'sso_only') {
        const existingKey = await getEmergencyKey();
        if (!existingKey) {
          const newKey = crypto.randomUUID();
          await pool.query(
            `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [EMERGENCY_KEY_KEY, newKey]
          );
        }
      }

      const emergencyKey = await getEmergencyKey();
      return reply.send({
        data: {
          mode,
          emergencyKey,
          loginUrl: emergencyKey
            ? `${FRONTEND_ORIGIN}/login?emergency=${emergencyKey}`
            : null,
        },
        message: `Login mode set to ${mode.replace('_', ' ')}.`,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to set login mode.' });
    }
  });

  // POST /admin/login-mode/regenerate-emergency-key
  fastify.post('/admin/login-mode/regenerate-emergency-key', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const newKey = crypto.randomUUID();
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [EMERGENCY_KEY_KEY, newKey]
      );
      return reply.send({
        data: {
          emergencyKey: newKey,
          loginUrl: `${FRONTEND_ORIGIN}/login?emergency=${newKey}`,
        },
        message: 'Emergency login key regenerated. The old key no longer works.',
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to regenerate emergency key.' });
    }
  });

  // POST /admin/directory-sync/test-connection
  fastify.post('/admin/directory-sync/test-connection', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      const body = testConnectionSchema.parse(request.body);

      // Validate credentials by attempting a token exchange.
      // Web application OAuth clients don't support client_credentials, so we
      // deliberately use an invalid redirect_uri to distinguish between:
      //   "invalid_client"  → bad client_id/client_secret
      //   "invalid_grant"   → credentials are fine (wrong flow, which is expected)
      const tokenResponse = await httpsPost('https://oauth2.googleapis.com/token', {
        client_id: body.clientId,
        client_secret: body.clientSecret,
        grant_type: 'authorization_code',
        code: 'validation_check',
        redirect_uri: 'http://localhost/validation',
      });

      const error = tokenResponse.error;
      const desc = tokenResponse.error_description || '';

      if (error) {
        // "invalid_grant" with a mention of "code" means credentials are valid
        // (Google accepted them but our fake code isn't a real auth code)
        if (error === 'invalid_grant' && desc.toLowerCase().includes('code')) {
          // Credentials are valid! Now test directory access if domain given.
          if (body.domain) {
            try {
              // We can't get a real token without a real auth code, but we know
              // the credentials are valid. Attempt to validate directory access
              // by checking if the domain looks plausible.
              return reply.send({
                data: {
                  success: true,
                  message: 'Credentials are valid. Domain was provided but full directory access can only be verified after completing the OAuth flow ("Connect Google Workspace" button above).',
                },
              });
            } catch {
              return reply.send({
                data: {
                  success: false,
                  message: 'Credentials are valid but could not verify directory access with the provided domain.',
                },
              });
            }
          }

          return reply.send({
            data: {
              success: true,
              message: 'Credentials are valid. Complete the OAuth flow using the "Connect Google Workspace" button above to enable directory sync.',
            },
          });
        }

        // Any other error means the credentials themselves are invalid
        return reply.send({
          data: {
            success: false,
            message: friendlyError(`${error}: ${desc}`),
          },
        });
      }

      // Shouldn't normally reach here (auth_code without a real code should fail)
      return reply.send({
        data: {
          success: true,
          message: 'Connection validation complete.',
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: err.message });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: `Test connection failed: ${friendlyError(err.message)}` });
    }
  });

}


