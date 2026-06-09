// azure-ad-sync.ts — API routes for Microsoft Entra ID (Azure AD) directory sync
// Endpoints for configuration, sync trigger, status, logs, connection testing, and disconnect

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import {
  loadAzureAdConfig,
  saveAzureAdConfig,
  syncAzureAd,
  AzureAdConfig,
} from '../services/azure-ad-sync';

// In-memory sync status tracker
interface SyncStatusInfo {
  lastSyncAt: string | null;
  status: 'idle' | 'running' | 'success' | 'error';
  usersCreated: number;
  usersUpdated: number;
  usersDeactivated: number;
  lastError: string | null;
}

let syncStatus: SyncStatusInfo = {
  lastSyncAt: null,
  status: 'idle',
  usersCreated: 0,
  usersUpdated: 0,
  usersDeactivated: 0,
  lastError: null,
};

// Schema for saving Azure AD config
const azureAdConfigSchema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  client_id: z.string().min(1, 'Client ID is required'),
  client_secret: z.string().min(1, 'Client secret is required'),
  auto_create_users: z.boolean().default(true),
  auto_deactivate_users: z.boolean().default(false),
  default_role: z.string().default('user'),
  sync_interval_minutes: z.number().min(5).max(1440).default(60),
  field_mapping: z.record(z.string()).default({}),
  group_role_mapping: z.record(z.string()).default({}),
  connected: z.boolean().default(false),
  email: z.string().optional(),
});

export default async function azureAdSyncRoutes(fastify: FastifyInstance) {
  // GET /admin/azure-ad/config — Get Azure AD config (admin only, mask client_secret)
  fastify.get(
    '/admin/azure-ad/config',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const config = await loadAzureAdConfig();
        if (!config) {
          return reply.send({ data: null });
        }

        // Mask client_secret in response
        const masked = { ...config };
        if (masked.client_secret) {
          masked.client_secret = '********';
        }

        return reply.send({ data: masked });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to load Azure AD config.' });
      }
    }
  );

  // POST /admin/azure-ad/config — Save Azure AD config (admin only)
  fastify.post(
    '/admin/azure-ad/config',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const body = azureAdConfigSchema.parse(request.body);

        // Protect the real client_secret from being overwritten by the redacted placeholder
        if (body.client_secret === '********') {
          const existing = await loadAzureAdConfig();
          if (existing && existing.client_secret && existing.client_secret !== '********') {
            body.client_secret = existing.client_secret;
          }
        }

        await saveAzureAdConfig(body as AzureAdConfig);
        return reply.send({ data: body, message: 'Azure AD configuration saved.' });
      } catch (err: any) {
        if (err.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: err.message });
        }
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to save Azure AD config.' });
      }
    }
  );

  // POST /admin/azure-ad/sync — Trigger manual sync (admin only)
  fastify.post(
    '/admin/azure-ad/sync',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const config = await loadAzureAdConfig();
        if (!config || !config.connected) {
          return reply.status(400).send({ error: 'Azure AD is not connected. Save and test connection first.' });
        }

        syncStatus = { ...syncStatus, status: 'running' };

        // Run sync in background — do not await so we return immediately
        const user = (request as any).user;
        const startedBy = user?.id;
        syncAzureAd(config, startedBy).then((result) => {
          syncStatus = {
            lastSyncAt: new Date().toISOString(),
            status: result.error ? 'error' : 'success',
            usersCreated: result.created,
            usersUpdated: result.updated,
            usersDeactivated: result.deactivated,
            lastError: result.error || null,
          };
        }).catch((err) => {
          syncStatus = {
            ...syncStatus,
            status: 'error',
            lastError: err.message,
          };
        });

        return reply.send({ message: 'Azure AD sync started.' });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to start Azure AD sync.' });
      }
    }
  );

  // GET /admin/azure-ad/status — Get sync status (admin only)
  fastify.get(
    '/admin/azure-ad/status',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const config = await loadAzureAdConfig();
        return reply.send({
          data: {
            ...syncStatus,
            connected: config?.connected || false,
            configEmail: config?.email || null,
          },
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to get sync status.' });
      }
    }
  );

  // GET /admin/azure-ad/logs — Get sync logs (admin only, paginated)
  fastify.get(
    '/admin/azure-ad/logs',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const query = request.query as { limit?: string; offset?: string };
        const limit = Math.min(parseInt(query.limit || '20'), 100);
        const offset = Math.max(parseInt(query.offset || '0'), 0);

        const result = await pool.query(
          'SELECT * FROM azure_ad_sync_log ORDER BY started_at DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        );

        const countResult = await pool.query(
          'SELECT COUNT(*) FROM azure_ad_sync_log'
        );

        return reply.send({
          data: result.rows,
          total: parseInt(countResult.rows[0].count),
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch sync logs.' });
      }
    }
  );

  // GET /admin/azure-ad/test — Test connection (admin only)
  fastify.get(
    '/admin/azure-ad/test',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const config = await loadAzureAdConfig();
        if (!config) {
          return reply.status(400).send({ error: 'Azure AD not configured. Save configuration first.' });
        }

        // Import the service dynamically to test connection
        const { syncAzureAd: testSync } = await import('../services/azure-ad-sync');

        // Try to obtain a token by running a lightweight test
        // We use the internal getGraphToken via syncAzureAd with a limited scope
        // Instead, let's just try fetching the token and one user
        const https = await import('https');

        const body = new URLSearchParams({
          client_id: config.client_id,
          client_secret: config.client_secret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }).toString();

        const token = await new Promise<string>((resolve, reject) => {
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

        // Now try fetching one user to verify directory access
        const testUser = await new Promise<any>((resolve, reject) => {
          const req = https.request({
            hostname: 'graph.microsoft.com',
            path: '/v1.0/users?$top=1&$select=id,displayName,mail',
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
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

        const userCount = testUser['@odata.count'] || testUser.value?.length || 0;

        // Mark as connected on successful test
        config.connected = true;
        if (testUser.value?.[0]?.mail) {
          config.email = testUser.value[0].mail;
        }
        await saveAzureAdConfig(config);

        return reply.send({
          data: {
            success: true,
            message: 'Connection to Microsoft Graph API successful.',
            userCount,
          },
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(400).send({
          data: {
            success: false,
            message: err.message || 'Connection test failed',
          },
        });
      }
    }
  );

  // POST /admin/azure-ad/disconnect — Disconnect Azure AD (admin only)
  fastify.post(
    '/admin/azure-ad/disconnect',
    { preHandler: [fastify.requirePermission('manage_directory_sync')] },
    async (request, reply) => {
      try {
        const config = await loadAzureAdConfig();
        if (config) {
          config.connected = false;
          await saveAzureAdConfig(config);
        }
        return reply.send({ message: 'Azure AD disconnected successfully.' });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to disconnect Azure AD.' });
      }
    }
  );
}
