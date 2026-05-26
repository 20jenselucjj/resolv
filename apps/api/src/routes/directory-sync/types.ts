export interface SyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'in_progress' | 'success' | 'error';
  usersSynced: number;
  usersCreated: number;
  usersUpdated: number;
  usersDeactivated: number;
  lastError: string | null;
  nextSyncAt: string | null;
}
