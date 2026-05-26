import crypto from 'crypto';
import { pool } from '../../db/pool';
import { getStoredTokens, storeTokens, httpsPost, httpsGet } from '../oauth';

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

export async function getValidAccessToken(): Promise<string> {
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

export async function logSync(
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

export async function fetchGoogleDirectoryUsers(accessToken: string): Promise<any[]> {
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

export async function fetchGoogleDirectoryUser(accessToken: string, email: string): Promise<any> {
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

export async function searchGoogleDirectoryUsers(accessToken: string, query: string): Promise<any[]> {
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

export async function fetchGoogleDirectoryGroups(accessToken: string): Promise<any[]> {
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

export async function fetchGroupMembers(accessToken: string, groupKey: string): Promise<string[]> {
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

export function resolveFieldPath(obj: any, path: string): any {
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

export function mapDirectoryUser(dirUser: any, fieldMapping: Record<string, string>): Record<string, any> {
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

export function friendlyError(error: string): string {
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

export const LOGIN_MODE_KEY = 'login_mode';
export const EMERGENCY_KEY_KEY = 'login_emergency_key';

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

export const FRONTEND_ORIGIN = process.env.WEB_URL || 'http://localhost:3000';