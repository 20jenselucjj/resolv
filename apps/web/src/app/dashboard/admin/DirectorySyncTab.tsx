'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { CheckCircle, Plug } from 'lucide-react';
import type { DirectorySyncConfig, SyncStatus, SyncLogEntry, RoleMapping, FieldMapping } from './components/directory-sync';
import {
  DEFAULT_FIELD_MAPPING, DEFAULT_CONFIG,
  ensureAnimations,
  LoadingSkeleton,
  SetupWizard,
  ConnectedStatusBanner,
  SyncErrorBanner,
  ProviderAndSyncConfig,
  RoleMappingSection,
  LoginModeSection,
  SyncControlsSection,
  SyncHistorySection,
  SaveButton,
  getTokenExpiryInfo,
  formatDateTime,
  formatRelativeTime,
} from './components/directory-sync';

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

  // Login Mode state
  const [loginMode, setLoginMode] = useState<'both' | 'sso_only' | 'password_only'>('both');
  const [emergencyLoginUrl, setEmergencyLoginUrl] = useState<string | null>(null);
  const [loginModeSaving, setLoginModeSaving] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const oauthConnected = !!config.oauthConnected;

  useEffect(() => { ensureAnimations(); }, []);

  // --- Setup Progress Calculation ---

  const setupSteps = [
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
  ];

  const tokenExpiry = getTokenExpiryInfo(config);

  // --- Login Mode Fetching ---

  const fetchLoginMode = useCallback(async () => {
    try {
      const res = await api.get<{ data: { mode: string; loginUrl: string | null } }>('/admin/login-mode');
      if (res.data) {
        setLoginMode(res.data.mode as any);
        setEmergencyLoginUrl(res.data.loginUrl);
      }
    } catch { /* login mode endpoint may not exist yet */ }
  }, []);

  // --- Data Fetching ---

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statusRes, logsRes] = await Promise.all([
        api.get<{ data: DirectorySyncConfig }>('/admin/directory-sync/config').catch(() => null),
        api.get<{ data: SyncStatus }>('/admin/directory-sync/status').catch(() => null),
        api.get<{ data: SyncLogEntry[] }>('/admin/directory-sync/logs').catch(() => null),
      ]);

      if (configRes?.data) {
        setConfig(prev => ({
          ...DEFAULT_CONFIG,
          ...configRes.data,
          fieldMapping: { ...DEFAULT_FIELD_MAPPING, ...configRes.data.fieldMapping },
          roleMapping: configRes.data.roleMapping ?? [],
        }));
      }
      if (statusRes?.data) {
        setSyncStatus(statusRes.data);
      }
      if (logsRes?.data) {
        setSyncLogs(logsRes.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch directory sync data:', err);
      showAlert('Failed to load directory sync configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchAll();
    fetchLoginMode();
  }, [fetchAll, fetchLoginMode]);

  // --- Handlers ---

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      // Never send the redacted placeholder back — let the backend keep the real secret
      if (payload.clientSecret === '********') {
        delete payload.clientSecret;
      }
      await api.post('/admin/directory-sync/config', payload);
      showAlert('Directory sync configuration saved successfully');
      fetchAll();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save directory sync configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await api.post('/admin/directory-sync/sync', {});
      showAlert('Sync initiated successfully');
      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const statusRes = await api.get<{ data: SyncStatus }>('/admin/directory-sync/status');
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
    } catch (err: any) {
      showAlert(err.message || 'Failed to start sync', 'error');
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.clientId || !config.clientSecret) {
      showAlert('Client ID and Client Secret are required to test the connection', 'error');
      return;
    }
    setTestingConnection(true);
    try {
      const response = await api.post<{ data: { success: boolean; message: string } }>('/admin/directory-sync/test-connection', {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        domain: config.domain || null,
      });
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Connection test failed');
      }
      showAlert(response.data?.message || 'Connection test successful');
    } catch (err: any) {
      showAlert(err.message || 'Connection test failed', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisconnectOAuth = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Workspace OAuth? This will break the directory sync connection.')) return;
    setDisconnecting(true);
    try {
      await api.post('/oauth/google/disconnect', {});
      showAlert('OAuth connection disconnected');
      setConfig(prev => ({
        ...prev,
        oauthConnected: false,
        oauthProvider: undefined,
        oauthDomain: undefined,
      }));
      fetchAll();
    } catch (err: any) {
      showAlert(err.message || 'Failed to disconnect OAuth', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReauthenticate = () => {
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/oauth/google/authorize`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleRetrySync = async () => {
    setRetrying(true);
    try {
      await api.post('/admin/directory-sync/sync', {});
      showAlert('Sync retry initiated');
      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const statusRes = await api.get<{ data: SyncStatus }>('/admin/directory-sync/status');
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
    } catch (err: any) {
      showAlert(err.message || 'Failed to retry sync', 'error');
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

  const handleLoginModeChange = async (mode: 'both' | 'sso_only' | 'password_only') => {
    setLoginModeSaving(true);
    try {
      const res = await api.post<{ data: { mode: string; loginUrl: string | null } }>('/admin/login-mode', { mode });
      if (res.data) {
        setLoginMode(res.data.mode as any);
        setEmergencyLoginUrl(res.data.loginUrl);
      }
      showAlert(`Login mode set to ${mode.replace('_', ' ')}`);
    } catch (err: any) {
      showAlert(err.message || 'Failed to update login mode', 'error');
    } finally {
      setLoginModeSaving(false);
    }
  };

  const handleRegenerateEmergencyKey = async () => {
    if (!window.confirm('Regenerating the emergency key will invalidate the current one. Continue?')) return;
    setRegeneratingKey(true);
    try {
      const res = await api.post<{ data: { loginUrl: string } }>('/admin/login-mode/regenerate-emergency-key', {});
      if (res.data) {
        setEmergencyLoginUrl(res.data.loginUrl);
      }
      showAlert('Emergency login key regenerated');
    } catch (err: any) {
      showAlert(err.message || 'Failed to regenerate emergency key', 'error');
    } finally {
      setRegeneratingKey(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showAlert('Failed to copy URL', 'error');
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
        '/admin/directory-sync/sync-users',
        { emails }
      );
      setSyncUsersResults(res.data);
      showAlert(`Synced ${res.data.results.length} user(s): ${res.data.created} created, ${res.data.updated} updated, ${res.data.errors} errors`);
      setSelectedUsers([]);
    } catch (err: any) {
      showAlert(err.message || 'Failed to sync selected users', 'error');
    } finally {
      setSyncingUsers(false);
    }
  };

  const handleUserSearch = useCallback(async (query: string) => {
    if (query.length < 2) return;
    setSearchingUsers(true);
    try {
      const res = await api.post<{ data: Array<{ email: string; name?: string }> }>(
        '/admin/directory-sync/search-users',
        { query }
      );
      setUserSearchResults(res.data);
    } catch (err: any) {
      console.error('User search failed:', err);
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
            handleReauthenticate={handleReauthenticate}
            handleDisconnectOAuth={handleDisconnectOAuth}
            disconnecting={disconnecting}
            formatDateTime={formatDateTime}
          />
        ) : (
          <SetupWizard setupSteps={setupSteps} />
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
        />

        {/* ===== Role Mapping ===== */}
        <RoleMappingSection
          config={config}
          handleAddRoleMapping={handleAddRoleMapping}
          handleRemoveRoleMapping={handleRemoveRoleMapping}
          handleRoleMappingChange={handleRoleMappingChange}
        />

        {/* ===== Login Mode ===== */}
        <LoginModeSection
          loginMode={loginMode}
          handleLoginModeChange={handleLoginModeChange}
          loginModeSaving={loginModeSaving}
          emergencyLoginUrl={emergencyLoginUrl}
          handleCopyUrl={handleCopyUrl}
          copied={copied}
          handleRegenerateEmergencyKey={handleRegenerateEmergencyKey}
          regeneratingKey={regeneratingKey}
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
        />
      </div>
    </div>
  );
}
