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

async function getRolePermissions(): Promise<Record<string, string[]>> {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'role_permissions'");
    if (result.rows.length === 0) return getDefaultPermissions();
    const stored = JSON.parse(result.rows[0].value);
    const perms: Record<string, string[]> = {};
    for (const role of stored) {
      perms[role.id] = role.permissions.filter((p: any) => p.enabled).map((p: any) => p.key);
    }
    return perms;
  } catch {
    return getDefaultPermissions();
  }
}

function getDefaultPermissions(): Record<string, string[]> {
  return {
    admin: ['manage_users', 'manage_settings', 'manage_sla', 'manage_categories',
            'delete_tickets', 'view_audit_log', 'manage_automation', 'view_all_tickets',
            'assign_tickets', 'manage_assets', 'manage_asset_groups', 'manage_email_templates',
            'manage_notification_settings', 'manage_workflows', 'manage_backup',
            'manage_ai_config', 'manage_directory_sync', 'manage_portal',
            'manage_agent_settings', 'manage_reports', 'manage_integrations'],
    manager: ['manage_users', 'manage_sla', 'manage_categories', 'view_audit_log',
              'manage_automation', 'view_all_tickets', 'assign_tickets',
              'manage_assets', 'manage_asset_groups', 'manage_email_templates',
              'manage_notification_settings', 'manage_portal', 'manage_agent_settings',
              'manage_reports'],
    agent: ['view_all_tickets', 'assign_tickets', 'manage_assets'],
    user: [],
    readonly: ['view_all_tickets', 'view_audit_log', 'manage_reports'],
  };
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.decorate('requireRole', function (roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        const user = request.user as JwtPayload;
        if (!roles.includes(user.role)) {
          reply.status(403).send({ error: 'Forbidden' });
        }
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
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
          reply.status(403).send({ error: `Forbidden - missing permission: ${permission}` });
        }
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
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
