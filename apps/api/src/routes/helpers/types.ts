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

export let syncStatus: SyncStatus = {
  lastSyncAt: null,
  status: 'idle',
  usersSynced: 0,
  usersCreated: 0,
  usersUpdated: 0,
  usersDeactivated: 0,
  lastError: null,
  nextSyncAt: null,
};