'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  CheckCircle, XCircle, Plug, ZapOff, RefreshCw,
  Save, Globe, Key, Shield, Clock, Users,
  AlertTriangle, Eye, EyeOff, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AzureAdConfig {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  auto_create_users: boolean;
  auto_deactivate_users: boolean;
  default_role: string;
  sync_interval_minutes: number;
  field_mapping: Record<string, string>;
  group_role_mapping: Record<string, string>;
  connected: boolean;
  email?: string;
}

interface SyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'running' | 'success' | 'error';
  usersCreated: number;
  usersUpdated: number;
  usersDeactivated: number;
  lastError: string | null;
  connected: boolean;
  configEmail: string | null;
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  status: string;
  users_created: number;
  users_updated: number;
  users_deactivated: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  started_by: string | null;
}

const DEFAULT_CONFIG: AzureAdConfig = {
  tenant_id: '',
  client_id: '',
  client_secret: '',
  auto_create_users: true,
  auto_deactivate_users: false,
  default_role: 'user',
  sync_interval_minutes: 60,
  field_mapping: {
    displayName: 'name',
    mail: 'email',
    userPrincipalName: 'username',
    department: 'department',
    jobTitle: 'title',
    officeLocation: 'location',
  },
  group_role_mapping: {},
  connected: false,
};

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function AzureAdSyncTab({
  showAlert,
}: {
  showAlert: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [config, setConfig] = useState<AzureAdConfig>(DEFAULT_CONFIG);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [showGroupMapping, setShowGroupMapping] = useState(false);
  const [savedConfigHash, setSavedConfigHash] = useState('');

  const computeHash = (cfg: AzureAdConfig) =>
    JSON.stringify({
      tenant_id: cfg.tenant_id,
      client_id: cfg.client_id,
      client_secret: cfg.client_secret === '********' ? undefined : cfg.client_secret,
      auto_create_users: cfg.auto_create_users,
      auto_deactivate_users: cfg.auto_deactivate_users,
      default_role: cfg.default_role,
      sync_interval_minutes: cfg.sync_interval_minutes,
    });

  const hasUnsavedChanges = useMemo(() => {
    if (!savedConfigHash) return false;
    return computeHash(config) !== savedConfigHash;
  }, [config, savedConfigHash]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statusRes, logsRes] = await Promise.all([
        api.get<{ data: AzureAdConfig }>('/admin/azure-ad/config').catch(() => null),
        api.get<{ data: SyncStatus }>('/admin/azure-ad/status').catch(() => null),
        api.get<{ data: SyncLogEntry[] }>('/admin/azure-ad/logs').catch(() => null),
      ]);

      if (configRes?.data) {
        setConfig({ ...DEFAULT_CONFIG, ...configRes.data });
        setSavedConfigHash(computeHash(configRes.data));
      }
      if (statusRes?.data) {
        setSyncStatus(statusRes.data);
      }
      if (logsRes?.data) {
        setSyncLogs(logsRes.data);
      }
    } catch {
      showAlert('Failed to load Azure AD configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      if (payload.client_secret === '********') {
        delete (payload as any).client_secret;
      }
      await api.post('/admin/azure-ad/config', payload);
      setSavedConfigHash(computeHash(config));
      showAlert('Azure AD configuration saved successfully');
      fetchAll();
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.tenant_id || !config.client_id || !config.client_secret) {
      showAlert('Tenant ID, Client ID, and Client Secret are required', 'error');
      return;
    }

    setSaving(true);
    try {
      // Save config first so the test endpoint can use it
      const payload = { ...config };
      if (payload.client_secret === '********') {
        delete (payload as any).client_secret;
      }
      await api.post('/admin/azure-ad/config', payload);
    } catch {
      showAlert('Failed to save config before testing', 'error');
      setSaving(false);
      return;
    }
    setSaving(false);

    setTesting(true);
    try {
      const res = await api.get<{ data: { success: boolean; message: string; userCount?: number } }>(
        '/admin/azure-ad/test'
      );
      if (res.data?.success === false) {
        throw new Error(res.data.message || 'Connection test failed');
      }
      showAlert(res.data?.message || 'Connection successful');
      fetchAll();
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await api.post('/admin/azure-ad/sync', {});
      showAlert('Sync started');
      // Poll for completion
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await api.get<{ data: SyncStatus }>('/admin/azure-ad/status');
          if (res?.data) {
            setSyncStatus(res.data);
            if (res.data.status !== 'running' || attempts > 30) {
              clearInterval(interval);
              fetchAll();
            }
          }
        } catch {
          clearInterval(interval);
          fetchAll();
        }
      }, 2000);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to start sync', 'error');
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Azure AD? The configuration will be preserved but sync will stop.')) return;
    try {
      await api.post('/admin/azure-ad/disconnect', {});
      showAlert('Azure AD disconnected');
      fetchAll();
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card resp-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Connection Status Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: config.connected ? 'var(--success-bg)' : 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {config.connected ? <CheckCircle size={20} color="var(--success)" /> : <ZapOff size={20} color="var(--text-muted)" />}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Microsoft Entra ID (Azure AD)</div>
              <div style={{ fontSize: '13px', color: config.connected ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
                {config.connected ? 'Connected' : 'Not Connected'}
                {config.email && <span style={{ color: 'var(--text-secondary)' }}> &middot; {config.email}</span>}
              </div>
            </div>
          </div>

          {config.connected && (
            <button
              className="btn btn-ghost"
              style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              onClick={handleDisconnect}
            >
              <Trash2 size={14} />
              Disconnect
            </button>
          )}
        </div>

        {/* Config Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            <Key size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Azure AD Application Credentials
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Tenant ID <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={config.tenant_id}
                onChange={(e) => setConfig({ ...config, tenant_id: e.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '13px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Client ID <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={config.client_id}
                onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '13px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Client Secret <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.client_secret}
                onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                placeholder="Enter your Azure AD client secret"
                style={{
                  width: '100%', padding: '8px 12px', paddingRight: '36px', fontSize: '13px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px',
                }}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Sync Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            <SettingsIcon size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Sync Settings
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Default Role
              </label>
              <select
                value={config.default_role}
                onChange={(e) => setConfig({ ...config, default_role: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '13px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                }}
              >
                <option value="user">User</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Sync Interval (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={config.sync_interval_minutes}
                onChange={(e) => setConfig({ ...config, sync_interval_minutes: parseInt(e.target.value) || 60 })}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '13px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={config.auto_create_users}
                onChange={(e) => setConfig({ ...config, auto_create_users: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              Auto-create users from Azure AD
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={config.auto_deactivate_users}
                onChange={(e) => setConfig({ ...config, auto_deactivate_users: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              Auto-deactivate users not in Azure AD
            </label>
          </div>
        </div>

        {/* Field Mapping (collapsible) */}
        <div>
          <button
            onClick={() => setShowFieldMapping(!showFieldMapping)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700,
              color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}
          >
            <Globe size={14} />
            Field Mapping
            {showFieldMapping ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showFieldMapping && (
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.entries(config.field_mapping).map(([key, value]) => (
                <div key={key}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    {key}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setConfig({
                      ...config,
                      field_mapping: { ...config.field_mapping, [key]: e.target.value },
                    })}
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: '12px',
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group Role Mapping (collapsible) */}
        <div>
          <button
            onClick={() => setShowGroupMapping(!showGroupMapping)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700,
              color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}
          >
            <Shield size={14} />
            Group Role Mapping
            {showGroupMapping ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showGroupMapping && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Map Azure AD groups to Resolv roles. Format: Group ID or name as key, role name as value.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.keys(config.group_role_mapping).length === 0 && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-muted)' }}>
                    No group mappings configured. Add mappings below.
                  </div>
                )}
                {Object.entries(config.group_role_mapping).map(([groupId, role]) => (
                  <div key={groupId} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={groupId}
                      placeholder="Azure AD Group ID"
                      onChange={(e) => {
                        const newMapping = { ...config.group_role_mapping };
                        delete newMapping[groupId];
                        if (e.target.value) newMapping[e.target.value] = role;
                        setConfig({ ...config, group_role_mapping: newMapping });
                      }}
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: '12px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                    <select
                      value={role}
                      onChange={(e) => setConfig({
                        ...config,
                        group_role_mapping: { ...config.group_role_mapping, [groupId]: e.target.value },
                      })}
                      style={{
                        padding: '6px 10px', fontSize: '12px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                      }}
                    >
                      <option value="user">User</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => {
                        const newMapping = { ...config.group_role_mapping };
                        delete newMapping[groupId];
                        setConfig({ ...config, group_role_mapping: newMapping });
                      }}
                      className="btn btn-ghost"
                      style={{ padding: '4px 8px', color: 'var(--danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setConfig({
                    ...config,
                    group_role_mapping: { ...config.group_role_mapping, '': 'user' },
                  })}
                >
                  + Add Mapping
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <button
            className={`btn btn-primary btn-save${saving ? ' saving' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            onClick={handleTestConnection}
            disabled={testing}
          >
            <Shield size={14} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            onClick={handleSyncNow}
            disabled={syncing || !config.connected}
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Sync Status & Stats */}
        {syncStatus && (
          <div style={{
            padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Sync Status</span>
              {syncStatus.status === 'running' && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-subtle)', color: 'var(--accent)',
                }}>
                  RUNNING
                </span>
              )}
              {syncStatus.status === 'success' && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  background: 'var(--success-bg)', color: 'var(--success)',
                }}>
                  <CheckCircle size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                  SUCCESS
                </span>
              )}
              {syncStatus.status === 'error' && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  background: 'var(--critical-bg)', color: 'var(--critical)',
                }}>
                  <XCircle size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                  ERROR
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Sync</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>
                  {syncStatus.lastSyncAt ? formatDateTime(syncStatus.lastSyncAt) : 'Never'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--success)', marginTop: '2px' }}>
                  <Users size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {syncStatus.usersCreated}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Updated</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)', marginTop: '2px' }}>
                  <RefreshCw size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {syncStatus.usersUpdated}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deactivated</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warning)', marginTop: '2px' }}>
                  <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {syncStatus.usersDeactivated}
                </div>
              </div>
            </div>

            {syncStatus.lastError && (
              <div style={{
                marginTop: '12px', padding: '10px 14px',
                background: 'var(--critical-bg)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--critical-border)',
                fontSize: '12px', color: 'var(--critical)',
              }}>
                <AlertTriangle size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {syncStatus.lastError}
              </div>
            )}
          </div>
        )}

        {/* Sync Log Table */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px 0' }}>
            <Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Sync History
          </h3>
          {syncLogs.length === 0 ? (
            <div style={{
              padding: '24px', textAlign: 'center', color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
              fontSize: '13px',
            }}>
              No sync logs yet. Run a sync to see results here.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Created</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Updated</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Deactivated</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(log.started_at)}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text)' }}>{log.sync_type}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: log.status === 'completed' ? 'var(--success-bg)' :
                            log.status === 'failed' ? 'var(--critical-bg)' : 'var(--accent-subtle)',
                          color: log.status === 'completed' ? 'var(--success)' :
                            log.status === 'failed' ? 'var(--critical)' : 'var(--accent)',
                        }}>
                          {log.status === 'completed' && <CheckCircle size={10} />}
                          {log.status === 'failed' && <XCircle size={10} />}
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)' }}>{log.users_created}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)' }}>{log.users_updated}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)' }}>{log.users_deactivated}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--critical)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.error_message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CSS animation for spin */}
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function SettingsIcon({ size, style }: { size?: number; style?: React.CSSProperties }) {
  return <svg width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>;
}
