// azure-ad-sync.ts — Microsoft Entra ID (Azure AD) directory synchronization
// Uses Microsoft Graph API v1.0 with client credentials flow (service-to-service)
// Token caching to avoid hitting the token endpoint on every request

import https from 'https';
import crypto from 'crypto';
import { pool } from '../db/pool';

export interface AzureAdConfig {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  auto_create_users: boolean;
  auto_deactivate_users: boolean;
  default_role: string;
  sync_interval_minutes: number;
  field_mapping: Record<string, string>;
  group_role_mapping: Record<string, string>;
  connected: boolean;
  email?: string;
}

interface GraphToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: GraphToken | null = null;

// Get Microsoft Graph API access token using client credentials flow
async function getGraphToken(config: AzureAdConfig): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  const body = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'login.microsoftonline.com',
      path: `/${config.tenant_id}/oauth2/v2.0/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            return reject(new Error(json.error_description || json.error));
          }
          cachedToken = {
            access_token: json.access_token,
            expires_at: Date.now() + (json.expires_in || 3600) * 1000,
          };
          resolve(json.access_token);
        } catch {
          reject(new Error('Failed to parse token response'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Generic Graph API fetch with pagination support
async function fetchGraphAll<T>(initialUrl: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = initialUrl;

  while (url) {
    const parsed = new URL(url);
    const page = await new Promise<any>((resolve, reject) => {
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ConsistencyLevel: 'eventual',
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Failed to parse Graph API response')); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    items.push(...(page.value || []));
    url = page['@odata.nextLink'] || null;
  }

  return items;
}

// Fetch users from Microsoft Graph API
async function fetchGraphUsers(token: string): Promise<any[]> {
  return fetchGraphAll(
    'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,givenName,surname,department,jobTitle,officeLocation,accountEnabled&$top=999',
    token
  );
}

// Fetch groups from Microsoft Graph API
async function fetchGraphGroups(token: string): Promise<any[]> {
  return fetchGraphAll(
    'https://graph.microsoft.com/v1.0/groups?$select=id,displayName&$top=999',
    token
  );
}

// Fetch members of a specific group
async function fetchGroupMembers(token: string, groupId: string): Promise<any[]> {
  return fetchGraphAll(
    `https://graph.microsoft.com/v1.0/groups/${groupId}/members/microsoft.graph.user?$select=id&$top=999`,
    token
  );
}

// Main sync function — fetches all users from Azure AD and upserts into local DB
export async function syncAzureAd(
  config: AzureAdConfig,
  startedBy?: string
): Promise<{
  created: number;
  updated: number;
  deactivated: number;
  error?: string;
}> {
  const logId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO azure_ad_sync_log (id, sync_type, status, started_by)
     VALUES ($1, 'full', 'running', $2)`,
    [logId, startedBy || null]
  );

  try {
    const token = await getGraphToken(config);
    const graphUsers = await fetchGraphUsers(token);
    const mapping = config.field_mapping || {};

    let created = 0;
    let updated = 0;
    let deactivated = 0;
    const syncedEmails: string[] = [];

    for (const gu of graphUsers) {
      const email = gu.mail || gu.userPrincipalName;
      if (!email) continue;

      const emailLower = email.toLowerCase();
      syncedEmails.push(emailLower);

      const name = gu.displayName || email;
      const isActive = gu.accountEnabled !== false;

      const existing = await pool.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [emailLower]
      );

      if (existing.rows.length > 0) {
        // Update existing user
        const user = existing.rows[0];
        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (user.name !== name) {
          updates.push(`name = $${idx++}`);
          params.push(name);
        }
        if (user.source !== 'azure_ad') {
          updates.push(`source = $${idx++}`);
          params.push('azure_ad');
        }
        if (user.department !== (gu.department || null)) {
          updates.push(`department = $${idx++}`);
          params.push(gu.department || null);
        }
        if (user.title !== (gu.jobTitle || null)) {
          updates.push(`title = $${idx++}`);
          params.push(gu.jobTitle || null);
        }
        if (user.location !== (gu.officeLocation || null)) {
          updates.push(`location = $${idx++}`);
          params.push(gu.officeLocation || null);
        }
        if (user.external_id !== gu.id) {
          updates.push(`external_id = $${idx++}`);
          params.push(gu.id);
        }

        // Always update sync timestamp and active status
        updates.push('last_sync_at = NOW()');
        updates.push(`is_active = $${idx++}`);
        params.push(isActive);

        if (updates.length > 0) {
          params.push(user.id);
          await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
            params
          );
          updated++;
        }
      } else if (config.auto_create_users && isActive) {
        // Create new user
        try {
          await pool.query(
            `INSERT INTO users (email, name, password_hash, role, source, is_active, department, title, location, external_id, last_sync_at)
             VALUES ($1, $2, 'azure-ad-no-password', $3, 'azure_ad', true, $4, $5, $6, $7, NOW())`,
            [
              emailLower,
              name,
              config.default_role || 'user',
              gu.department || null,
              gu.jobTitle || null,
              gu.officeLocation || null,
              gu.id,
            ]
          );
          created++;
        } catch (insertErr: any) {
          // Ignore duplicate key errors (race condition)
          if (insertErr.code !== '23505') throw insertErr;
        }
      }
    }

    // Deactivate users that exist in local DB with source='azure_ad' but not in Azure AD
    if (config.auto_deactivate_users && syncedEmails.length > 0) {
      const placeholders = syncedEmails.map((_, i) => `$${i + 1}`).join(',');
      const params = [...syncedEmails];

      // First try to delete users with no associated content
      const deleteResult = await pool.query(
        `DELETE FROM users
         WHERE source = 'azure_ad'
           AND is_active = true
           AND LOWER(email) NOT IN (${placeholders})
           AND id NOT IN (SELECT DISTINCT created_by_id FROM tickets WHERE created_by_id IS NOT NULL)
           AND id NOT IN (SELECT DISTINCT author_id FROM ticket_comments WHERE author_id IS NOT NULL)
           AND id NOT IN (SELECT DISTINCT author_id FROM knowledge_articles WHERE author_id IS NOT NULL)
           AND id NOT IN (SELECT DISTINCT assigned_to_id FROM tickets WHERE assigned_to_id IS NOT NULL)
         RETURNING id`,
        params
      );
      const hardDeleted = deleteResult.rowCount || 0;

      // Deactivate remaining users who have associated content
      await pool.query(
        `UPDATE users SET is_active = false
         WHERE source = 'azure_ad'
           AND is_active = true
           AND LOWER(email) NOT IN (${placeholders})
           AND last_sync_at IS NOT NULL`,
        params
      );

      deactivated = hardDeleted;
    }

    // Update sync log with success
    await pool.query(
      `UPDATE azure_ad_sync_log
       SET status = 'completed', users_created = $1, users_updated = $2, users_deactivated = $3, completed_at = NOW()
       WHERE id = $4`,
      [created, updated, deactivated, logId]
    );

    return { created, updated, deactivated };
  } catch (err: any) {
    // Update sync log with failure
    await pool.query(
      `UPDATE azure_ad_sync_log
       SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE id = $2`,
      [err.message, logId]
    );
    return { created: 0, updated: 0, deactivated: 0, error: err.message };
  }
}

// Load Azure AD config from system_settings
export async function loadAzureAdConfig(): Promise<AzureAdConfig | null> {
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'azure_ad_config'"
  );
  if (result.rows.length === 0) return null;
  try {
    return JSON.parse(result.rows[0].value);
  } catch {
    return null;
  }
}

// Save Azure AD config to system_settings
export async function saveAzureAdConfig(config: AzureAdConfig): Promise<void> {
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('azure_ad_config', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify(config)]
  );
}
