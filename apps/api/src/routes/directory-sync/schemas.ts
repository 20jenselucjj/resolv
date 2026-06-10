import { z } from 'zod';

export const configSchema = z.object({
  enabled: z.boolean().optional().default(false),
  autoProvision: z.boolean().optional().default(false),
  defaultRole: z.enum(['admin', 'manager', 'agent', 'user', 'readonly']).optional().default('user'),
  syncIntervalMinutes: z.number().int().min(1).optional().default(60),
  fieldMapping: z.record(z.string()).optional().default({
    name: 'name.fullName',
    email: 'primaryEmail',
    department: 'department',
    job_title: 'title',
    phone: 'phones[0].value',
    external_id: 'id',
    employee_id: 'externalIds[0].value',
    location: 'locations[0].buildingId',
    manager_email: 'relations[type=manager].value',
    cost_center: 'organizations[0].costCenter',
    google_admin: 'isAdmin',
    suspended: 'suspended',
  }),
  roleMapping: z.array(z.object({
    directoryGroup: z.string(),
    role: z.enum(['admin', 'manager', 'agent', 'user', 'readonly']),
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

export const testConnectionSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  domain: z.string().optional().nullable(),
});
