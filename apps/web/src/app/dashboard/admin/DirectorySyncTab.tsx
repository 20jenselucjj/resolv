'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { CheckCircle, Plug } from 'lucide-react';
import type { DirectorySyncConfig, SyncStatus, SyncLogEntry, RoleMapping, FieldMapping, ProviderType } from './components/directory-sync';
import {
  DEFAULT_FIELD_MAPPING, DEFAULT_AZURE_FIELD_MAPPING, DEFAULT_CONFIG,
  ensureAnimations,
  LoadingSkeleton,
  SetupWizard,
  ConnectedStatusBanner,
  SyncErrorBanner,
  ProviderAndSyncConfig,
  RoleMappingSection,
  SyncControlsSection,
  SyncHistorySection,
  SaveButton,
  getTokenExpiryInfo,
  formatDateTime,
  formatRelativeTime,
} from './components/directory-sync';

// --- Helpers ---

function getApiPrefix(provider: ProviderType): string {
  return provider === 'azure_ad' ? '/admin/azure-ad' : '/admin/directory-sync';
}

// --- Component ---

export function DirectorySyncTab({
  showAlert,
}: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [config, setConfig] = useState<DirectorySyncConfig>(DEFAULT_CONFIG);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Sync Selected Users state
  const [selectedUsers, setSelectedUsers] = useState<Array<{ email: string; name?: string }>>([]);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [syncUsersResults, setSyncUsersResults] = useState<{
    total: number; created: number; updated: number; skipped: number;
    notFound: number; errors: number;
    results: Array<{ email: string; status: string; name?: string; error?: string }>;
  } | null>(null);
  const [showSyncUsers, setShowSyncUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<Array<{ email: string; name?: string }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Track whether we've opened the OAuth popup (for focus-based refresh fallback)
  const oauthPendingRef = useRef(false);

  // Track last saved config to detect unsaved changes
  const [savedConfigHash, setSavedConfigHash] = useState('');

  const computeConfigHash = (cfg: Partial<DirectorySyncConfig>) => JSON.stringify({
    provider: cfg.provider,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret === '********' ? undefined : cfg.clientSecret,
    tenantId: cfg.tenantId,
    domain: cfg.domain,
    enabled: cfg.enabled,
    autoProvision: cfg.autoProvision,
    autoDeactivate: cfg.autoDeactivate,
    defaultRole: cfg.defaultRole,
    syncIntervalMinutes: cfg.syncIntervalMinutes,
    fieldMapping: cfg.fieldMapping,
    roleMapping: cfg.roleMapping,
    azureFieldMapping: cfg.azureFieldMapping,
    groupRoleMapping: cfg.groupRoleMapping,
  });

  const hasUnsavedChanges = useMemo(() => {
    if (!savedConfigHash) return false;
    return computeConfigHash(config) !== savedConfigHash;
  }, [config, savedConfigHash]);

  const oauthConnected = !!config.oauthConnected;

  useEffect(() => { ensureAnimations(); }, []);

  // --- Setup Progress Calculation ---

  const provider = config.provider;
  const isGoogle = provider === 'google_workspace';
  const isAzure = provider === 'azure_ad';
  const apiPrefix = getApiPrefix(provider);

  const setupSteps = isGoogle ? [
    {
      key: 'credentials',
      label: 'OAuth Credentials',
      description: 'Create OAuth credentials in Google Cloud Console',
      completed: !!(config.clientId && config.clientSecret),
    },
    {
      key: 'domain',
      label: 'Domain Configuration',
      description: 'Enter your Google Workspace domain',
      completed: !!config.domain,
    },
    {
      key: 'oauth',
      label: 'OAuth Connection',
      description: 'Connect and authorize Google Workspace',
      completed: oauthConnected,
    },
    {
      key: 'sync',
      label: 'Sync Configuration',
      description: 'Configure sync settings and enable',
      completed: config.enabled,
    },
  ] : [
    {
      key: 'credentials',
      label: 'Azure AD Credentials',
      description: 'Register an app in Azure AD and get credentials',
      completed: !!(config.tenantId && config.clientId && config.clientSecret),
    },
    {
      key: 'domain',
      label: 'Connection Configuration',
      description: 'Configure connection settings',
      completed: true,
    },
    {
      key: 'oauth',
      label: 'Test Connection',
      description: 'Verify Azure AD connection and permissions',
      completed: oauthConnected,
    },
    {
      key: 'sync',
      label: 'Sync Configuration',
      description: 'Configure sync settings and enable',
      completed: config.enabled,
    },
  ];

  const tokenExpiry = getTokenExpiryInfo(config);

  // --- Data Fetching ---

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const prefix = getApiPrefix(config.provider);
      const [configRes, statusRes, logsRes] = await Promise.all([
        api.get<{ data: DirectorySyncConfig }>(`${prefix}/config`).catch(() => null),
        api.get<{ data: SyncStatus }>(`${prefix}/status`).catch(() => null),
        api.get<{ data: SyncLogEntry[] }>(`${prefix}/logs`).catch(() => null),
      ]);

      if (configRes?.data) {
        const merged = {
          ...DEFAULT_CONFIG,
          ...configRes.data,
          fieldMapping: { ...DEFAULT_FIELD_MAPPING, ...configRes.data.fieldMapping },
          roleMapping: configRes.data.roleMapping ?? [],
        };
        // For Azure AD, merge azure field mapping defaults
        if (merged.provider === 'azure_ad') {
          merged.azureFieldMapping = { ...DEFAULT_AZURE_FIELD_MAPPING, ...configRes.data.azureFieldMapping };
          merged.groupRoleMapping = configRes.data.groupRoleMapping ?? {};
        }
        setConfig(merged);
        setSavedConfigHash(computeConfigHash(configRes.data));
      }
      if (statusRes?.data) {
        setSyncStatus(statusRes.data);
      }
      if (logsRes?.data) {
        setSyncLogs(logsRes.data);
      }
    } catch (err: unknown) {
      toast.error('Failed to fetch directory sync data', err instanceof Error ? err.message : 'Please try again');
      showAlert('Failed to load directory sync configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert, config.provider]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchAll, config.provider]);

  // Re-fetch when provider changes
  const handleProviderChange = useCallback((newProvider: ProviderType) => {
    if (newProvider !== config.provider) {
      setConfig(prev => ({
        ...DEFAULT_CONFIG,
        provider: newProvider,
        azureFieldMapping: newProvider === 'azure_ad' ? { ...DEFAULT_AZURE_FIELD_MAPPING } : undefined,
        groupRoleMapping: newProvider === 'azure_ad' ? {} : undefined,
      }));
      setSyncStatus(null);
      setSyncLogs([]);
      setSavedConfigHash('');
    }
  }, [config.provider]);

  // Listen for OAuth completion from the callback tab (postMessage) + focus fallback
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-connected' && (event.data?.provider === 'google_workspace' || event.data?.provider === 'azure_ad')) {
        oauthPendingRef.current = false;
        fetchAll();
      }
    };
    const onFocus = () => {
      if (oauthPendingRef.current) {
        oauthPendingRef.current = false;
        fetchAll();
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchAll]);

  // --- Handlers ---

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      // Never send the redacted placeholder back — let the backend keep the real secret
      if (payload.clientSecret === '********') {
        delete payload.clientSecret;
      }
      await api.post(`${apiPrefix}/config`, payload);
      setSavedConfigHash(computeConfigHash(payload));
      showAlert('Directory sync configuration saved successfully');
      fetchAll();
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to save directory sync configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await api.post(`${apiPrefix}/sync`, {});
      showAlert('Sync initiated successfully');
      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const statusRes = await api.get<{ data: SyncStatus }>(`${apiPrefix}/status`);
          if (statusRes?.data) {
            setSyncStatus(statusRes.data);
            if (statusRes.data.status !== 'syncing' || pollAttempts > 20) {
              clearInterval(pollInterval);
              fetchAll();
            }
          }
        } catch {
          clearInterval(pollInterval);
          fetchAll();
        }
      }, 2000);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to start sync', 'error');
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    if (isGoogle) {
      if (!config.clientId || !config.clientSecret) {
        showAlert('Client ID and Client Secret are required to test the connection', 'error');
        return;
      }
    } else {
      if (!config.tenantId || !config.clientId || !config.clientSecret) {
        showAlert('Tenant ID, Client ID, and Client Secret are required to test the connection', 'error');
        return;
      }
    }
    setTestingConnection(true);
    try {
      // For Azure AD, first save config so the test endpoint can use it
      if (isAzure) {
        const payload = { ...config };
        if (payload.clientSecret === '********') {
          delete (payload as any).clientSecret;
        }
        await api.post(`${apiPrefix}/config`, payload);
      }

      const endpoint = isGoogle ? '/admin/directory-sync/test-connection' : `${apiPrefix}/test`;
      const response = await api.post<{ data: { success: boolean; message: string } }>(endpoint, {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        domain: config.domain || null,
        tenantId: isAzure ? config.tenantId : undefined,
      });
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Connection test failed');
      }
      showAlert(response.data?.message || 'Connection test successful');
      if (isAzure) fetchAll();
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Connection test failed', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisconnectOAuth = async () => {
    if (isGoogle) {
      if (!window.confirm('Are you sure you want to disconnect Google Workspace OAuth? This will break the directory sync connection.')) return;
    } else {
      if (!window.confirm('Are you sure you want to disconnect Azure AD? The configuration will be preserved but sync will stop.')) return;
    }
    setDisconnecting(true);
    try {
      if (isGoogle) {
        await api.post('/oauth/google/disconnect', {});
      } else {
        await api.post(`${apiPrefix}/disconnect`, {});
      }
      showAlert('Connection disconnected');
      setConfig(prev => ({
        ...prev,
        oauthConnected: false,
        oauthProvider: undefined,
        oauthDomain: undefined,
      }));
      fetchAll();
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const initOAuthFlow = useCallback(async () => {
    // Auto-save credentials first so the OAuth endpoint can read them from DB
    try {
      const payload = { ...config };
      if (payload.clientSecret === '********') {
        delete payload.clientSecret;
      }
      await api.post(`${apiPrefix}/config`, payload);
      setSavedConfigHash(computeConfigHash(payload));
    } catch {
      showAlert('Failed to save credentials before connecting. Please save manually first.', 'error');
      return;
    }

    oauthPendingRef.current = true;
    const oauthPath = isGoogle
      ? '/oauth/google/authorize'
      : '/oauth/azure/authorize';
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}${oauthPath}`,
      '_blank'
    );
  }, [config, showAlert, apiPrefix, isGoogle]);

  const handleRetrySync = async () => {
    setRetrying(true);
    try {
      await api.post(`${apiPrefix}/sync`, {});
      showAlert('Sync retry initiated');
      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const statusRes = await api.get<{ data: SyncStatus }>(`${apiPrefix}/status`);
          if (statusRes?.data) {
            setSyncStatus(statusRes.data);
            if (statusRes.data.status !== 'syncing' || pollAttempts > 20) {
              clearInterval(pollInterval);
              fetchAll();
            }
          }
        } catch {
          clearInterval(pollInterval);
          fetchAll();
        }
      }, 2000);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to retry sync', 'error');
    } finally {
      setRetrying(false);
    }
  };

  const handleAddRoleMapping = () => {
    setConfig(prev => ({
      ...prev,
      roleMapping: [...(prev.roleMapping || []), { directoryGroup: '', role: 'user' as const }],
    }));
  };

  const handleRemoveRoleMapping = (index: number) => {
    setConfig(prev => ({
      ...prev,
      roleMapping: (prev.roleMapping || []).filter((_, i) => i !== index),
    }));
  };

  const handleRoleMappingChange = (index: number, field: keyof RoleMapping, value: string) => {
    setConfig(prev => {
      const mappings = [...(prev.roleMapping || [])];
      mappings[index] = { ...mappings[index], [field]: value };
      return { ...prev, roleMapping: mappings };
    });
  };

  const handleFieldMappingChange = (field: keyof FieldMapping, value: string) => {
    setConfig(prev => ({
      ...prev,
      fieldMapping: { ...prev.fieldMapping, [field]: value },
    }));
  };

  const handleSyncSelectedUsers = async () => {
    if (selectedUsers.length === 0) return;
    const emails = selectedUsers.map(u => u.email);
    if (emails.length === 0) {
      showAlert('Select at least one user', 'error');
      return;
    }
    if (emails.length > 20) {
      showAlert('Maximum 20 users per sync request', 'error');
      return;
    }
    setSyncingUsers(true);
    setSyncUsersResults(null);
    try {
      const res = await api.post<{ data: {
        total: number; created: number; updated: number; skipped: number;
        notFound: number; errors: number;
        results: Array<{ email: string; status: string; name?: string; error?: string }>;
      } }>(
        `${apiPrefix}/sync-users`,
        { emails }
      );
      setSyncUsersResults(res.data);
      showAlert(`Synced ${res.data.results.length} user(s): ${res.data.created} created, ${res.data.updated} updated, ${res.data.errors} errors`);
      setSelectedUsers([]);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to sync selected users', 'error');
    } finally {
      setSyncingUsers(false);
    }
  };

  const handleUserSearch = useCallback(async (query: string) => {
    if (query.length < 2) return;
    setSearchingUsers(true);
    try {
      const res = await api.post<{ data: Array<{ email: string; name?: string }> }>(
        `${apiPrefix}/search-users`,
        { query }
      );
      setUserSearchResults(res.data);
    } catch (err: unknown) {
      toast.error('User search failed', err instanceof Error ? err.message : 'Please try again');
      setUserSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  // --- Loading State ---

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <LoadingSkeleton />
      </div>
    );
  }

  // --- Render ---

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card resp-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Quick status pill — compact, top-right */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 'var(--radius-full)',
          background: oauthConnected ? 'var(--success-bg)' : 'var(--bg-tertiary)',
          border: `1px solid ${oauthConnected ? 'var(--success-border)' : 'var(--border)'}`,
          fontSize: '11px', fontWeight: 600,
          color: oauthConnected ? 'var(--success)' : 'var(--text-muted)',
          alignSelf: 'flex-end', whiteSpace: 'nowrap',
        }}>
          {oauthConnected ? <CheckCircle size={12} /> : <Plug size={12} />}
          {oauthConnected ? 'Connected' : 'Not Connected'}
        </div>

        {/* ===== Setup Wizard / Connection Status ===== */}
        {oauthConnected ? (
          <ConnectedStatusBanner
            config={config}
            tokenExpiry={tokenExpiry}
            syncStatus={syncStatus}
            handleReauthenticate={initOAuthFlow}
            handleDisconnectOAuth={handleDisconnectOAuth}
            disconnecting={disconnecting}
            formatDateTime={formatDateTime}
          />
        ) : (
          <SetupWizard
            setupSteps={setupSteps}
            onConnectOAuth={initOAuthFlow}
            hasUnsavedChanges={hasUnsavedChanges}
            provider={provider}
          />
        )}

        {/* ===== Sync Error Banner ===== */}
        <SyncErrorBanner
          syncStatus={syncStatus}
          handleRetrySync={handleRetrySync}
          retrying={retrying}
        />

        {/* ===== Provider & Sync Config ===== */}
        <ProviderAndSyncConfig
          config={config}
          setConfig={setConfig}
          oauthConnected={oauthConnected}
          showClientSecret={showClientSecret}
          setShowClientSecret={setShowClientSecret}
          handleTestConnection={handleTestConnection}
          testingConnection={testingConnection}
          handleFieldMappingChange={handleFieldMappingChange}
          onProviderChange={handleProviderChange}
        />

        {/* ===== Role Mapping ===== */}
        <RoleMappingSection
          config={config}
          handleAddRoleMapping={handleAddRoleMapping}
          handleRemoveRoleMapping={handleRemoveRoleMapping}
          handleRoleMappingChange={handleRoleMappingChange}
        />

        {/* ===== Sync Controls & Status ===== */}
        <SyncControlsSection
          syncing={syncing}
          oauthConnected={oauthConnected}
          syncStatus={syncStatus}
          handleSyncNow={handleSyncNow}
          config={config}
          showSyncUsers={showSyncUsers}
          setShowSyncUsers={setShowSyncUsers}
          selectedUsers={selectedUsers}
          setSelectedUsers={setSelectedUsers}
          userSearchQuery={userSearchQuery}
          setUserSearchQuery={setUserSearchQuery}
          handleUserSearch={handleUserSearch}
          syncingUsers={syncingUsers}
          handleSyncSelectedUsers={handleSyncSelectedUsers}
          syncUsersResults={syncUsersResults}
          searchingUsers={searchingUsers}
          showUserDropdown={showUserDropdown}
          setShowUserDropdown={setShowUserDropdown}
          userSearchResults={userSearchResults}
          setUserSearchResults={setUserSearchResults}
          formatRelativeTime={formatRelativeTime}
          formatDateTime={formatDateTime}
        />

        {/* ===== Sync History ===== */}
        <SyncHistorySection
          syncLogs={syncLogs}
          handleSyncNow={handleSyncNow}
          syncing={syncing}
          oauthConnected={oauthConnected}
        />

        {/* ===== Save Button ===== */}
        <SaveButton
          handleSave={handleSave}
          saving={saving}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </div>
    </div>
  );
}
