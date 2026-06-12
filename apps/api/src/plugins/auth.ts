import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { pool } from '../db/pool';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  name: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

let rolePermsCache: { data: Record<string, string[]>; ts: number } | null = null;
const CACHE_TTL = 10_000; // 10 seconds

async function getRolePermissions(): Promise<Record<string, string[]>> {
  if (rolePermsCache && Date.now() - rolePermsCache.ts < CACHE_TTL) {
    return rolePermsCache.data;
  }
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'role_permissions'");
    if (result.rows.length === 0) {
      const defaults = getDefaultPermissions();
      rolePermsCache = { data: defaults, ts: Date.now() };
      return defaults;
    }
    const stored = JSON.parse(result.rows[0].value);
    const perms: Record<string, string[]> = {};
    for (const role of stored) {
      perms[role.id] = role.permissions.filter((p: any) => p.enabled).map((p: any) => p.key);
    }
    rolePermsCache = { data: perms, ts: Date.now() };
    return perms;
  } catch {
    const defaults = getDefaultPermissions();
    rolePermsCache = { data: defaults, ts: Date.now() };
    return defaults;
  }
}

/** Bump the cache after PUT /admin/roles so the next check reads fresh data */
export function invalidateRolePermsCache(): void {
  rolePermsCache = null;
}

const ITSM_PERMS = [
  'view_problems', 'manage_problems', 'delete_problems',
  'view_changes', 'create_changes', 'manage_changes', 'approve_changes', 'delete_changes',
  'manage_knowledge', 'delete_knowledge', 'view_knowledge_drafts',
  'create_approvals', 'vote_approvals',
  'view_licenses', 'manage_licenses', 'delete_licenses',
  'manage_catalog', 'delete_catalog',
  'manage_custom_fields',
  'manage_classification',
  'manage_cmdb',
  'manage_major_incidents',
  'manage_releases',
  'manage_time_entries',
] as const;

const EMAIL_PERMS = [
  'manage_email_config',
  'manage_email_accounts',
  'email_create_tickets',
  'email_comment_tickets',
  'email_change_status',
  'email_change_priority',
  'email_assign_tickets',
  'email_close_tickets',
  'email_delete_tickets',
  'email_manage_watchers',
  'view_email_log',
  'retry_failed_emails',
] as const;

function getDefaultPermissions(): Record<string, string[]> {
  return {
    admin: ['manage_users', 'manage_settings', 'manage_sla', 'manage_categories',
            'delete_tickets', 'view_audit_log', 'manage_automation', 'view_all_tickets',
            'assign_tickets', 'manage_assets', 'manage_asset_groups', 'manage_email_templates',
            'manage_notification_settings', 'manage_workflows', 'manage_backup',
            'manage_ai_config', 'manage_directory_sync', 'manage_portal',
            'manage_agent_settings', 'manage_reports', 'manage_integrations',
            ...ITSM_PERMS, ...EMAIL_PERMS],
    manager: ['manage_users', 'manage_sla', 'manage_categories', 'view_audit_log',
              'manage_automation', 'view_all_tickets', 'assign_tickets',
              'manage_assets', 'manage_asset_groups', 'manage_email_templates',
              'manage_notification_settings', 'manage_portal', 'manage_agent_settings',
              'manage_reports',
               'view_problems', 'manage_problems',
               'view_changes', 'create_changes', 'manage_changes', 'approve_changes',
              'manage_knowledge', 'view_knowledge_drafts',
              'create_approvals', 'vote_approvals',
              'view_licenses', 'manage_licenses',
               'manage_catalog', 'manage_custom_fields', 'manage_classification',
               'manage_email_accounts', 'email_create_tickets', 'email_comment_tickets',
               'email_change_status', 'email_change_priority', 'email_assign_tickets',
               'email_close_tickets', 'email_manage_watchers', 'view_email_log', 'retry_failed_emails',
               'manage_cmdb', 'manage_major_incidents', 'manage_releases', 'manage_time_entries'],
    agent: ['view_all_tickets', 'assign_tickets', 'manage_assets',
            'view_problems', 'manage_problems',
            'view_changes', 'create_changes', 'manage_changes',
            'manage_knowledge', 'view_knowledge_drafts',
            'view_licenses',
            'email_create_tickets', 'email_comment_tickets', 'email_change_status',
            'email_change_priority', 'email_close_tickets', 'email_manage_watchers',
            'manage_cmdb', 'manage_major_incidents', 'manage_releases', 'manage_time_entries'],
    user: ['email_create_tickets', 'email_comment_tickets'],
    readonly: ['view_all_tickets', 'view_audit_log', 'manage_reports',
               'view_problems', 'view_changes', 'view_licenses',
               'view_email_log'],
  };
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // Check Authorization header first (standard Bearer token)
      const authHeader = request.headers.authorization;
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          await request.jwtVerify();
          return;
        }
      }
      // Fallback: check query parameter ?token=... (for attachment view/download via <img>, <iframe>, etc.)
      const queryToken = request.query ? (request.query as Record<string, string>).token : undefined;
      if (queryToken) {
        request.headers.authorization = `Bearer ${queryToken}`;
        await request.jwtVerify();
        return;
      }
      throw new Error('No token provided');
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.decorate('requireRole', function (roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        const user = request.user as JwtPayload;
        if (!roles.includes(user.role)) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    };
  });

  fastify.decorate('requirePermission', function (permission: string) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        const user = request.user as JwtPayload;

        // Admin always has all permissions
        if (user.role === 'admin') return;

        // Load permissions from system_settings
        const rolePermissions = await getRolePermissions();
        const userPermissions = rolePermissions[user.role] || [];

        if (!userPermissions.includes(permission)) {
          return reply.status(403).send({ error: `Forbidden - missing permission: ${permission}` });
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    };
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
