import { z } from 'zod';

export const configSchema = z.object({
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

export const testConnectionSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  domain: z.string().optional().nullable(),
});

export const syncUsersSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
});

export const loginModeSchema = z.object({
  mode: z.enum(['both', 'sso_only', 'password_only']),
});