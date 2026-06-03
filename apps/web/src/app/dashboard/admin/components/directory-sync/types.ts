'use client';

// --- Types ---

export type ProviderType = 'google_workspace';

export interface FieldMapping {
  email: string;
  name: string;
  department: string;
  jobTitle: string;
  phone: string;
}

export interface RoleMapping {
  directoryGroup: string;
  role: 'admin' | 'agent' | 'user';
}

export interface DirectorySyncConfig {
  enabled: boolean;
  provider: ProviderType;
  autoProvision: boolean;
  defaultRole: 'user' | 'agent';
  syncIntervalMinutes: number;
  fieldMapping: FieldMapping;
  roleMapping: RoleMapping[];
  clientId?: string;
  clientSecret?: string;
  secretCorrupted?: boolean;
  tenantId?: string;
  domain?: string;
  oauthConnected?: boolean;
  oauthProvider?: string;
  oauthDomain?: string;
  oauthEmail?: string;
  tokenExpiresAt?: string;
}

export interface SyncStats {
  synced: number;
  created: number;
  updated: number;
  deactivated: number;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  nextSyncAt?: string;
  stats?: SyncStats;
  error?: string;
}

export interface SyncLogEntry {
  id: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  status: 'success' | 'error' | 'in_progress';
  stats?: SyncStats;
  error?: string;
}