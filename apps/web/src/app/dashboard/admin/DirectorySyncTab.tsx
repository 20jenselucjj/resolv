'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Globe, CheckCircle, XCircle, RefreshCw, AlertTriangle, Settings,
  Link2, Unlink, Clock, Users, Database, Shield,
  Plus, Trash2, Save, Search, Plug, UserPlus,
  ExternalLink, Key, ArrowRight, Zap, Info,
  ChevronRight, Activity, AlertCircle, RotateCcw,
  CalendarClock, ShieldCheck, Timer, HardDrive, LogIn, Copy
} from 'lucide-react';

// --- Types ---

type ProviderType = 'google_workspace' | 'azure_ad' | 'okta';

interface FieldMapping {
  email: string;
  name: string;
  department: string;
  jobTitle: string;
  phone: string;
}

interface RoleMapping {
  directoryGroup: string;
  role: 'admin' | 'agent' | 'user';
}

interface DirectorySyncConfig {
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

interface SyncStats {
  synced: number;
  created: number;
  updated: number;
  deactivated: number;
}

interface SyncStatus {
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  nextSyncAt?: string;
  stats?: SyncStats;
  error?: string;
}

interface SyncLogEntry {
  id: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  status: 'success' | 'error' | 'in_progress';
  stats?: SyncStats;
  error?: string;
}

// --- Default Values ---

const DEFAULT_FIELD_MAPPING: FieldMapping = {
  email: 'primaryEmail',
  name: 'name.fullName',
  department: 'department',
  jobTitle: 'title',
  phone: 'phones[0].value',
};

const DEFAULT_CONFIG: DirectorySyncConfig = {
  enabled: false,
  provider: 'google_workspace',
  autoProvision: false,
  defaultRole: 'user',
  syncIntervalMinutes: 60,
  fieldMapping: { ...DEFAULT_FIELD_MAPPING },
  roleMapping: [],
};

// --- Keyframe Animations (injected once) ---

const STYLE_ID = 'directory-sync-animations';

function ensureAnimations() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ds-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes ds-shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    @keyframes ds-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ds-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .ds-skeleton {
      background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-subtle) 50%, var(--bg-tertiary) 75%);
      background-size: 800px 100%;
      animation: ds-shimmer 1.5s ease-in-out infinite;
      border-radius: var(--radius-md);
    }
    .ds-fade-in { animation: ds-fade-in 0.3s ease-out both; }
    .ds-spin { animation: ds-spin 1s linear infinite; }
  `;
  document.head.appendChild(style);
}

// --- InputField (stable component - defined outside parent to prevent remount on every render) ---

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  hidden = false,
  hint,
  icon,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  hidden?: boolean;
  hint?: string;
  icon?: React.ReactNode;
}) => {
  if (hidden) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </div>
        )}
        <input
          className="input"
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={icon ? { paddingLeft: 32 } : undefined}
        />
      </div>
      {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{hint}</span>}
    </div>
  );
};

// --- ToggleSwitch (stable - defined at module scope) ---

const ToggleSwitch = ({ enabled, onChange, small = false }: { enabled: boolean; onChange: () => void; small?: boolean }) => (
  <div
    onClick={onChange}
    style={{
      width: small ? 36 : 44,
      height: small ? 20 : 24,
      borderRadius: small ? 10 : 12,
      cursor: 'pointer',
      background: enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
      border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
      position: 'relative',
      transition: 'all 0.2s ease',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: small ? 1 : 2,
        left: enabled ? (small ? 18 : 22) : (small ? 1 : 2),
        width: small ? 16 : 18,
        height: small ? 16 : 18,
        borderRadius: '50%',
        background: enabled ? 'white' : 'var(--text-muted)',
        transition: 'left 0.2s ease',
        boxShadow: small ? undefined : '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  </div>
);

// --- Skeleton components (stable - defined at module scope) ---

const SkeletonBlock = ({ width, height, style }: { width: string | number; height: string | number; style?: React.CSSProperties }) => (
  <div
    className="ds-skeleton"
    style={{ width, height, ...style }}
  />
);

const LoadingSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    {/* Header skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkeletonBlock width="200px" height="24px" />
      <SkeletonBlock width="400px" height="16px" />
    </div>
    {/* Progress bar skeleton */}
    <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <SkeletonBlock width="140px" height="13px" style={{ marginBottom: 16 }} />
      <SkeletonBlock width="100%" height="8px" style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <SkeletonBlock width="32px" height="32px" style={{ borderRadius: '50%' }} />
            <SkeletonBlock width="80px" height="12px" />
            <SkeletonBlock width="60px" height="10px" />
          </div>
        ))}
      </div>
    </div>
    {/* Section skeletons */}
    {[1, 2, 3].map(i => (
      <div key={i} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonBlock width="160px" height="13px" />
        <SkeletonBlock width="100%" height="40px" />
        <SkeletonBlock width="100%" height="40px" />
      </div>
    ))}
  </div>
);

// --- Section wrapper (stable - defined at module scope) ---

const Section = ({ icon, iconBg, iconColor, label, description, children, badge }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  description?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) => (
  <div style={{
    padding: '24px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: description ? 20 : 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)',
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          {badge}
        </div>
        {description && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        )}
      </div>
    </div>
    {children}
  </div>
);

const EmptyState = ({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div style={{
    padding: '40px 24px',
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-secondary)',
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: '50%',
      background: 'var(--bg-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 14px',
      color: 'var(--text-muted)',
    }}>
      {icon}
    </div>
    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>{description}</div>
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

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
  const [selectedEmails, setSelectedEmails] = useState('');
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [syncUsersResults, setSyncUsersResults] = useState<{ total: number; created: number; updated: number; skipped: number; notFound: number; errors: number; results: Array<{ email: string; status: string; name?: string; error?: string }> } | null>(null);
  const [showSyncUsers, setShowSyncUsers] = useState(false);

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

  const completedSteps = setupSteps.filter(s => s.completed).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;
  const currentStepIndex = setupSteps.findIndex(s => !s.completed);

  // --- Token Expiry Helpers ---

  const getTokenExpiryInfo = () => {
    if (!config.tokenExpiresAt) return null;
    try {
      const expiry = new Date(config.tokenExpiresAt);
      const now = new Date();
      const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isExpired = hoursLeft <= 0;
      const isExpiringSoon = hoursLeft > 0 && hoursLeft <= 48;
      return { expiry, hoursLeft, isExpired, isExpiringSoon };
    } catch {
      return null;
    }
  };

  const tokenExpiry = getTokenExpiryInfo();

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
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/oauth/google/authorize`;
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
    if (!selectedEmails.trim()) return;
    const emails = selectedEmails
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));
    if (emails.length === 0) {
      showAlert('Enter at least one valid email address', 'error');
      return;
    }
    if (emails.length > 20) {
      showAlert('Maximum 20 users per sync request', 'error');
      return;
    }
    setSyncingUsers(true);
    setSyncUsersResults(null);
    try {
      const res = await api.post<{ data: { total: number; created: number; updated: number; skipped: number; notFound: number; errors: number; results: Array<{ email: string; status: string; name?: string; error?: string }> } }>(
        '/admin/directory-sync/sync-users',
        { emails }
      );
      setSyncUsersResults(res.data);
      showAlert(`Synced ${res.data.results.length} user(s): ${res.data.created} created, ${res.data.updated} updated, ${res.data.errors} errors`);
    } catch (err: any) {
      showAlert(err.message || 'Failed to sync selected users', 'error');
    } finally {
      setSyncingUsers(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDateTime(dateStr);
    } catch {
      return formatDateTime(dateStr);
    }
  };

  // --- Loading State ---

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px' }}>
        <LoadingSkeleton />
      </div>
    );
  }

  // --- Setup Wizard (shown when not connected) ---

  const renderSetupWizard = () => (
    <div className="ds-fade-in" style={{
      padding: '24px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg) 100%)',
    }}>
      {/* Progress Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Setup Progress</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
            {completedSteps === setupSteps.length
              ? 'All steps complete — you\'re ready to sync!'
              : `${completedSteps} of ${setupSteps.length} steps completed`}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: '50%',
          background: setupProgress === 100 ? 'var(--success-bg)' : 'var(--accent-subtle)',
          border: `2px solid ${setupProgress === 100 ? 'var(--success)' : 'var(--accent-border)'}`,
          fontSize: '14px', fontWeight: 700,
          color: setupProgress === 100 ? 'var(--success)' : 'var(--accent)',
        }}>
          {setupProgress === 100 ? <CheckCircle size={20} /> : `${completedSteps}/${setupSteps.length}`}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%', height: 6, borderRadius: 3,
        background: 'var(--bg-tertiary)', marginBottom: 24, overflow: 'hidden',
      }}>
        <div style={{
          width: `${setupProgress}%`, height: '100%', borderRadius: 3,
          background: setupProgress === 100
            ? 'linear-gradient(90deg, var(--success), #34d399)'
            : 'linear-gradient(90deg, var(--accent), var(--accent-mid))',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      {/* Step List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {setupSteps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isCompleted = step.completed;
          const isLast = index === setupSteps.length - 1;
          return (
            <div key={step.key} style={{ display: 'flex', gap: 16 }}>
              {/* Step indicator column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isCompleted
                    ? 'var(--success-bg)'
                    : isCurrent
                      ? 'var(--accent-subtle)'
                      : 'var(--bg-tertiary)',
                  border: `2px solid ${
                    isCompleted
                      ? 'var(--success)'
                      : isCurrent
                        ? 'var(--accent)'
                        : 'var(--border)'
                  }`,
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}>
                  {isCompleted ? (
                    <CheckCircle size={16} color="var(--success)" />
                  ) : isCurrent ? (
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{index + 1}</span>
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>{index + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 24,
                    background: isCompleted ? 'var(--success-border)' : 'var(--border)',
                    transition: 'background 0.3s ease',
                    margin: '4px 0',
                  }} />
                )}
              </div>
              {/* Step content */}
              <div style={{
                paddingBottom: isLast ? 0 : 20, flex: 1,
              }}>
                <div style={{
                  fontSize: '13px', fontWeight: 600,
                  color: isCompleted ? 'var(--success)' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                  marginBottom: 2,
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5,
                }}>
                  {step.description}
                </div>

                {/* Step-specific actions */}
                {isCurrent && step.key === 'credentials' && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--accent)', color: 'white',
                        fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                    >
                      <ExternalLink size={12} />
                      Open Google Cloud Console
                    </a>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Create OAuth 2.0 Client ID for a web application
                    </span>
                  </div>
                )}

                {isCurrent && step.key === 'oauth' && (
                  <div style={{ marginTop: 12 }}>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/oauth/google/authorize`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 18px', borderRadius: 'var(--radius-md)',
                        background: 'var(--accent)', color: 'white',
                        fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                        transition: 'background 0.15s',
                        boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.3)',
                      }}
                    >
                      <Link2 size={14} />
                      Connect Google Workspace
                    </a>
                  </div>
                )}

                {isCurrent && step.key === 'sync' && (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Enable directory sync in the Sync Configuration section below, then save your configuration.
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- Connected Status Banner ---

  const renderConnectedStatus = () => {
    const hasIssue = tokenExpiry?.isExpired || tokenExpiry?.isExpiringSoon || syncStatus?.status === 'error';
    return (
      <div className="ds-fade-in" style={{
        padding: '20px 24px',
        border: `1px solid ${hasIssue ? 'var(--warning-border)' : 'var(--success-border)'}`,
        borderRadius: 'var(--radius-lg)',
        background: hasIssue
          ? 'linear-gradient(135deg, var(--warning-bg) 0%, var(--bg) 100%)'
          : 'linear-gradient(135deg, var(--success-bg) 0%, var(--bg) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Left: Connection info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 'var(--radius-lg)',
              background: hasIssue ? 'var(--warning-bg)' : 'var(--success-bg)',
              color: hasIssue ? 'var(--warning)' : 'var(--success)',
              flexShrink: 0,
            }}>
              {hasIssue ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  {config.oauthProvider || 'Google Workspace'}
                </span>
                <span style={{
                  padding: '2px 10px', borderRadius: 'var(--radius-full)',
                  fontSize: '11px', fontWeight: 600,
                  background: hasIssue ? 'var(--warning-bg)' : 'var(--success-bg)',
                  color: hasIssue ? 'var(--warning)' : 'var(--success)',
                  border: `1px solid ${hasIssue ? 'var(--warning-border)' : 'var(--success-border)'}`,
                }}>
                  {hasIssue ? (tokenExpiry?.isExpired ? 'Token Expired' : 'Attention Needed') : 'Connected'}
                </span>
              </div>

              {/* Detail rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 4 }}>
                {config.oauthEmail && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Users size={12} style={{ flexShrink: 0 }} />
                    <span>Account: <strong style={{ color: 'var(--text)' }}>{config.oauthEmail}</strong></span>
                  </div>
                )}
                {config.oauthDomain && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Globe size={12} style={{ flexShrink: 0 }} />
                    <span>Domain: <strong style={{ color: 'var(--text)' }}>{config.oauthDomain}</strong></span>
                  </div>
                )}
                {config.tokenExpiresAt && tokenExpiry && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: tokenExpiry.isExpired ? 'var(--danger)' : tokenExpiry.isExpiringSoon ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    <Timer size={12} style={{ flexShrink: 0 }} />
                    <span>
                      Token {tokenExpiry.isExpired ? 'expired' : 'expires'}: <strong>{formatDateTime(config.tokenExpiresAt)}</strong>
                      {!tokenExpiry.isExpired && tokenExpiry.isExpiringSoon && (
                        <span style={{ marginLeft: 6, color: 'var(--warning)' }}>({Math.round(tokenExpiry.hoursLeft)}h remaining)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Warning for expiring/expired token */}
              {tokenExpiry && (tokenExpiry.isExpired || tokenExpiry.isExpiringSoon) && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  background: tokenExpiry.isExpired ? 'var(--danger-bg)' : 'var(--warning-bg)',
                  border: `1px solid ${tokenExpiry.isExpired ? 'var(--danger-border)' : 'var(--warning-border)'}`,
                  fontSize: '12px', color: tokenExpiry.isExpired ? 'var(--danger)' : 'var(--warning)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>
                    {tokenExpiry.isExpired
                      ? 'OAuth token has expired. Re-authenticate to restore sync functionality.'
                      : 'OAuth token is expiring soon. Re-authenticate to avoid sync interruptions.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {(tokenExpiry?.isExpired || tokenExpiry?.isExpiringSoon) && (
              <button
                onClick={handleReauthenticate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)', color: 'white',
                  border: 'none', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', transition: 'background 0.15s',
                  boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)',
                }}
              >
                <RefreshCw size={13} />
                Re-authenticate
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={handleDisconnectOAuth}
              disabled={disconnecting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', color: 'var(--danger)',
                fontSize: '12px', fontWeight: 500,
              }}
            >
              <Unlink size={13} />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- Sync Error Banner ---

  /** Identify what kind of error the user is seeing so we can show actionable advice */
  const getSyncErrorAdvice = (error: string): string => {
    const e = error.toLowerCase();
    if (e.includes('oauth') || e.includes('token') || e.includes('invalid_grant') || e.includes('expired'))
      return 'Reconnect OAuth by clicking "Re-authenticate" above, then try again.';
    if (e.includes('client_id') || e.includes('client_secret') || e.includes('invalid_client'))
      return 'Check your Client ID and Client Secret in the Provider Configuration section above.';
    if (e.includes('admin sdk') || e.includes('api') || e.includes('scope') || e.includes('permission'))
      return 'Enable the Admin SDK API in Google Cloud Console, and ensure the OAuth consent screen includes the correct scopes.';
    if (e.includes('domain') || e.includes('workspace') || e.includes('hd'))
      return 'Verify your Google Workspace domain is correct and has active user accounts.';
    if (e.includes('network') || e.includes('econnrefused') || e.includes('timeout') || e.includes('dns'))
      return 'A network error occurred. Check your internet connection and ensure the API can reach Google servers.';
    if (e.includes('not found') || e.includes('404'))
      return 'The directory resource was not found. Verify your domain and API configuration.';
    if (e.includes('rate') || e.includes('quota') || e.includes('limit') || e.includes('429'))
      return 'Google API rate limit hit. Wait a few minutes before retrying.';
    return 'Check the configuration above and ensure OAuth is connected properly.';
  };

  const renderSyncError = () => {
    if (!syncStatus?.error) return null;
    const advice = getSyncErrorAdvice(syncStatus.error);
    return (
      <div className="ds-fade-in" style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>Sync Error</div>
          <div style={{ fontSize: '12px', color: 'var(--danger)', lineHeight: 1.5, opacity: 0.85, marginBottom: 8 }}>{syncStatus.error}</div>
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: 'rgba(0,0,0,0.06)',
            fontSize: '12px', color: 'var(--danger)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>Suggestion:</strong> {advice}</span>
          </div>
        </div>
        <button
          onClick={handleRetrySync}
          disabled={retrying}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--danger)', color: 'white',
            border: 'none', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
            opacity: retrying ? 0.7 : 1,
            boxShadow: '0 2px 6px rgba(var(--danger-rgb), 0.3)',
          }}
        >
          <RotateCcw size={12} className={retrying ? 'ds-spin' : ''} />
          {retrying ? 'Retrying...' : 'Retry Sync'}
        </button>
      </div>
    );
  };

  // --- Render ---

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Quick status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 'var(--radius-full)',
          background: oauthConnected ? 'var(--success-bg)' : 'var(--bg-tertiary)',
          border: `1px solid ${oauthConnected ? 'var(--success-border)' : 'var(--border)'}`,
          fontSize: '12px', fontWeight: 600,
          color: oauthConnected ? 'var(--success)' : 'var(--text-muted)',
          alignSelf: 'flex-end',
        }}>
          {oauthConnected ? <CheckCircle size={13} /> : <Plug size={13} />}
          {oauthConnected ? 'Connected' : 'Not Connected'}
        </div>

        {/* ===== Setup Wizard / Connection Status ===== */}
        {oauthConnected ? renderConnectedStatus() : renderSetupWizard()}

        {/* ===== Sync Error Banner ===== */}
        {renderSyncError()}

        {/* ===== Provider Configuration ===== */}
        <Section
          icon={<Settings size={16} />}
          iconBg="var(--accent-subtle)"
          iconColor="var(--accent)"
          label="Provider Configuration"
          description="Configure your directory provider and OAuth credentials"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Provider Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Provider Type
                <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {([
                  { value: 'google_workspace', label: 'Google Workspace', icon: Globe },
                  { value: 'azure_ad', label: 'Azure AD', icon: Shield },
                  { value: 'okta', label: 'Okta', icon: ShieldCheck },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setConfig(prev => ({ ...prev, provider: value }))}
                    disabled={value === 'google_workspace' && oauthConnected}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '9px 18px', borderRadius: 'var(--radius-full)',
                      border: `1.5px solid ${config.provider === value ? 'var(--accent)' : 'var(--border)'}`,
                      background: config.provider === value ? 'var(--accent-subtle)' : 'transparent',
                      color: config.provider === value ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: (value === 'google_workspace' && oauthConnected) ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: config.provider === value ? 600 : 500,
                      opacity: (value === 'google_workspace' && oauthConnected) ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
              {config.provider === 'google_workspace' && oauthConnected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Info size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Provider is locked to Google Workspace while OAuth is connected. Disconnect to switch.
                  </span>
                </div>
              )}
            </div>

            {/* Credentials */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
              padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <InputField
                label="Client ID"
                value={config.clientId}
                onChange={val => setConfig(prev => ({ ...prev, clientId: val }))}
                placeholder="123456789-xxxxx.apps.googleusercontent.com"
                icon={<Key size={14} />}
                hint={config.provider === 'google_workspace'
                  ? 'From Google Cloud Console → APIs & Services → Credentials. Create an OAuth 2.0 Web Client ID.'
                  : 'The OAuth client ID provided by your identity provider.'}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client Secret</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showClientSecret ? 'text' : 'password'}
                    value={config.clientSecret ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter client secret"
                    style={{ paddingRight: 80 }}
                  />
                  <button
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500,
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {showClientSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stored securely and never displayed in full. In Google Cloud Console, set the Authorized Redirect URI to your API domain + <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>/api/oauth/google/callback</code></span>
              </div>
            </div>

            {/* Corruption warning */}
            {config.secretCorrupted && (
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '12px', color: 'var(--danger)', lineHeight: 1.5 }}>
                  <strong>Client secret corrupted.</strong> The stored client secret was overwritten by a redacted placeholder during a previous save. Re-enter it from Google Cloud Console and save again.
                </div>
              </div>
            )}

            {/* Tenant ID (Azure AD only) */}
            <InputField
              label="Tenant ID"
              value={config.tenantId}
              onChange={val => setConfig(prev => ({ ...prev, tenantId: val }))}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              hidden={config.provider !== 'azure_ad'}
              icon={<Shield size={14} />}
            />

            {/* Domain (Google Workspace only) */}
            <InputField
              label="Domain"
              value={config.domain}
              onChange={val => setConfig(prev => ({ ...prev, domain: val }))}
              placeholder="e.g. company.com"
              hidden={config.provider !== 'google_workspace'}
              icon={<Globe size={14} />}
              hint="Your Google Workspace domain name (e.g. your-company.com)"
            />

            {/* Test Connection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !config.clientId || !config.clientSecret}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 18px', borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    fontSize: '13px', fontWeight: 500,
                    cursor: testingConnection ? 'wait' : 'pointer',
                    opacity: (!config.clientId || !config.clientSecret) ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {testingConnection ? <RefreshCw size={14} className="ds-spin" /> : <Search size={14} />}
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                {(!config.clientId || !config.clientSecret) && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enter credentials above to test</span>
                )}
              </div>


            </div>
          </div>
        </Section>

        {/* ===== Sync Configuration ===== */}
        <Section
          icon={<Zap size={16} />}
          iconBg="var(--accent-subtle)"
          iconColor="var(--accent)"
          label="Sync Configuration"
          description="Control how and when directory sync runs"
          badge={config.enabled ? (
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
              fontSize: '10px', fontWeight: 600,
              background: 'var(--success-bg)', color: 'var(--success)',
              border: '1px solid var(--success-border)',
            }}>Active</span>
          ) : undefined}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Enable/Disable Toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '14px 16px', background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            }}>
              <ToggleSwitch
                enabled={config.enabled}
                onChange={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable Directory Sync</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Periodically sync users and groups from your directory provider</div>
              </div>
            </div>

            {/* Sync Settings (dimmed when disabled) */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '16px',
              opacity: config.enabled ? 1 : 0.5,
              pointerEvents: config.enabled ? 'auto' : 'none',
              transition: 'opacity 0.2s ease',
            }}>
              {/* Auto-Provision Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              }}>
                <ToggleSwitch
                  small
                  enabled={config.autoProvision}
                  onChange={() => setConfig(prev => ({ ...prev, autoProvision: !prev.autoProvision }))}
                />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>Auto-provision new users</span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Automatically create Resolv accounts for new directory users
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default Role</label>
                  <select
                    className="select"
                    value={config.defaultRole}
                    onChange={e => setConfig(prev => ({ ...prev, defaultRole: e.target.value as 'user' | 'agent' }))}
                    style={{ maxWidth: '100%' }}
                  >
                    <option value="user">User</option>
                    <option value="agent">Agent</option>
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to newly provisioned users</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sync Interval</label>
                  <select
                    className="select"
                    value={config.syncIntervalMinutes}
                    onChange={e => setConfig(prev => ({ ...prev, syncIntervalMinutes: parseInt(e.target.value) }))}
                    style={{ maxWidth: '100%' }}
                  >
                    <option value={5}>Every 5 minutes</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every hour</option>
                    <option value={360}>Every 6 hours</option>
                    <option value={1440}>Every 24 hours</option>
                    <option value={0}>Manual only</option>
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>How often to sync automatically</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ===== Field Mapping ===== */}
        <Section
          icon={<HardDrive size={16} />}
          iconBg="var(--bg-tertiary)"
          iconColor="var(--text-secondary)"
          label="Field Mapping"
          description="Map directory attributes to Resolv user fields"
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12,
              padding: '10px 16px', background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
              fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Resolv Field</span>
              <span>Directory Attribute</span>
              <span style={{ width: 100 }} />
            </div>
            {/* Field rows */}
            {([
              { key: 'email', label: 'Email', placeholder: 'email' },
              { key: 'name', label: 'Name', placeholder: 'name' },
              { key: 'department', label: 'Department', placeholder: 'department' },
              { key: 'jobTitle', label: 'Job Title', placeholder: 'title' },
              { key: 'phone', label: 'Phone', placeholder: 'phone' },
            ] as const).map(({ key, label, placeholder }, index) => (
              <div
                key={key}
                style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12,
                  padding: '10px 16px', alignItems: 'center',
                  borderBottom: index < 4 ? '1px solid var(--border-subtle)' : 'none',
                  background: 'var(--bg)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
                <input
                  className="input"
                  value={config.fieldMapping[key] ?? ''}
                  onChange={e => handleFieldMappingChange(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ maxWidth: '320px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: 100 }}>← directory attr</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== Role Mapping ===== */}
        <Section
          icon={<Shield size={16} />}
          iconBg="var(--accent-subtle)"
          iconColor="var(--accent)"
          label="Role Mapping"
          description="Map directory groups to Resolv roles"
          badge={config.roleMapping && config.roleMapping.length > 0 ? (
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
              fontSize: '10px', fontWeight: 600,
              background: 'var(--accent-subtle)', color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
            }}>{config.roleMapping.length}</span>
          ) : undefined}
        >
          {(!config.roleMapping || config.roleMapping.length === 0) ? (
            <EmptyState
              icon={<Shield size={24} />}
              title="No role mappings configured"
              description="Add mappings to automatically assign Resolv roles based on directory group membership. Users in matched groups will receive the corresponding role."
              action={
                <button
                  onClick={handleAddRoleMapping}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--accent)', color: 'white',
                    border: 'none', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} />
                  Add First Mapping
                </button>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {config.roleMapping.map((mapping, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <input
                      className="input"
                      value={mapping.directoryGroup}
                      onChange={e => handleRoleMappingChange(index, 'directoryGroup', e.target.value)}
                      placeholder="Directory group name (e.g. admins@company.com)"
                    />
                  </div>
                  <ArrowRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <div style={{ width: '150px' }}>
                    <select
                      className="select"
                      value={mapping.role}
                      onChange={e => handleRoleMappingChange(index, 'role', e.target.value)}
                    >
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleRemoveRoleMapping(index)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--danger)', display: 'flex', alignItems: 'center',
                      padding: '6px', borderRadius: 'var(--radius-sm)',
                      transition: 'background 0.15s',
                    }}
                    title="Remove mapping"
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddRoleMapping}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'transparent', border: '1px dashed var(--border)',
                  color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.background = 'var(--accent-subtle)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Plus size={14} />
                Add Mapping
              </button>
            </div>
          )}
        </Section>

        {/* ===== Login Mode ===== */}
        <Section
          icon={<LogIn size={16} />}
          iconBg="var(--accent-subtle)"
          iconColor="var(--accent)"
          label="Login Mode"
          description="Control how users sign in to the application"
          badge={
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
              fontSize: '10px', fontWeight: 600,
              background: loginMode === 'sso_only' ? 'var(--warning-bg)' : loginMode === 'password_only' ? 'var(--accent-subtle)' : 'var(--success-bg)',
              color: loginMode === 'sso_only' ? 'var(--warning)' : loginMode === 'password_only' ? 'var(--accent)' : 'var(--success)',
              border: `1px solid ${loginMode === 'sso_only' ? 'var(--warning-border)' : loginMode === 'password_only' ? 'var(--accent-border)' : 'var(--success-border)'}`,
            }}>
              {loginMode === 'both' ? 'Both' : loginMode === 'sso_only' ? 'SSO Only' : 'Password Only'}
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Mode selector cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {([
                { value: 'both' as const, label: 'Both', description: 'Users can sign in with email/password or SSO', icon: <LogIn size={18} /> },
                { value: 'sso_only' as const, label: 'SSO Only', description: 'Only SSO sign-in allowed. Emergency password login available.', icon: <Link2 size={18} /> },
                { value: 'password_only' as const, label: 'Password Only', description: 'Only email/password sign-in allowed. SSO hidden.', icon: <Key size={18} /> },
              ]).map(option => (
                <div
                  key={option.value}
                  onClick={() => handleLoginModeChange(option.value)}
                  style={{
                    padding: '16px', borderRadius: 'var(--radius-md)',
                    border: `2px solid ${loginMode === option.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: loginMode === option.value ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                    cursor: loginModeSaving ? 'wait' : 'pointer',
                    opacity: loginModeSaving ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}
                >
                  <div style={{ color: loginMode === option.value ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {option.icon}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: loginMode === option.value ? 'var(--accent)' : 'var(--text)' }}>
                      {option.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {option.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency backup URL (only shown for SSO Only) */}
            {loginMode === 'sso_only' && emergencyLoginUrl && (
              <div style={{
                padding: '16px',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <AlertTriangle size={14} color="var(--warning)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)' }}>
                    Emergency Password Login URL
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--warning)', opacity: 0.85, marginBottom: 12, lineHeight: 1.5 }}>
                  This secret URL allows password login when SSO is unavailable.
                  Share it only with trusted administrators. Anyone with this URL
                  can bypass SSO to sign in with email and password.
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    flex: 1, padding: '10px 14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--warning-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    color: 'var(--text)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {emergencyLoginUrl}
                  </div>
                  <button
                    onClick={() => handleCopyUrl(emergencyLoginUrl)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      background: 'var(--warning)', color: 'white',
                      border: 'none', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Copy size={13} />
                    {copied ? 'Copied!' : 'Copy URL'}
                  </button>
                  <button
                    onClick={handleRegenerateEmergencyKey}
                    disabled={regeneratingKey}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      border: '1px solid var(--warning-border)',
                      color: 'var(--warning)', fontSize: '12px', fontWeight: 600,
                      cursor: regeneratingKey ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                      opacity: regeneratingKey ? 0.7 : 1,
                    }}
                  >
                    <RefreshCw size={12} className={regeneratingKey ? 'ds-spin' : ''} />
                    {regeneratingKey ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ===== Sync Controls & Status ===== */}
        <Section
          icon={<Activity size={16} />}
          iconBg="var(--accent-subtle)"
          iconColor="var(--accent)"
          label="Sync Controls & Status"
          description="Run manual syncs and view current status"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleSyncNow}
                disabled={syncing || !oauthConnected}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 22px', fontSize: '13px', fontWeight: 600,
                  opacity: !oauthConnected ? 0.5 : 1,
                }}
              >
                {syncing ? (
                  <RefreshCw size={15} className="ds-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>

              {!oauthConnected && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={12} />
                  Connect OAuth to enable sync
                </span>
              )}

              {/* Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Status:</span>
                {syncStatus?.status === 'syncing' ? (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 'var(--radius-full)',
                    fontSize: '12px', fontWeight: 600,
                    background: 'var(--accent-subtle)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                  }}>
                    <RefreshCw size={12} className="ds-spin" />
                    Syncing
                  </span>
                ) : syncStatus?.status === 'error' ? (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 'var(--radius-full)',
                    fontSize: '12px', fontWeight: 600,
                    background: 'var(--danger-bg)', color: 'var(--danger)',
                    border: '1px solid var(--danger-border)',
                  }}>
                    <AlertTriangle size={12} />
                    Error
                  </span>
                ) : (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 'var(--radius-full)',
                    fontSize: '12px', fontWeight: 600,
                    background: 'var(--success-bg)', color: 'var(--success)',
                    border: '1px solid var(--success-border)',
                  }}>
                    <CheckCircle size={12} />
                    Idle
                  </span>
                )}
              </div>
            </div>

            {/* Timestamps & Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Timestamps */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                padding: '16px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  <CalendarClock size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  Schedule
                </div>

                {/* Last successful sync */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last successful sync</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    {formatRelativeTime(syncStatus?.lastSuccessfulSyncAt || syncStatus?.lastSyncAt) || formatDateTime(syncStatus?.lastSuccessfulSyncAt || syncStatus?.lastSyncAt)}
                  </span>
                  {(syncStatus?.lastSuccessfulSyncAt && syncStatus?.lastSyncAt && syncStatus.lastSuccessfulSyncAt !== syncStatus.lastSyncAt) && (
                    <span style={{ fontSize: '10px', color: 'var(--warning)' }}>
                      Last attempt ({formatRelativeTime(syncStatus.lastSyncAt)}) failed
                    </span>
                  )}
                </div>

                {/* Last attempted sync (only show if different from successful) */}
                {syncStatus?.lastSyncAt && syncStatus?.lastSuccessfulSyncAt && syncStatus.lastSuccessfulSyncAt !== syncStatus.lastSyncAt && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last attempted sync</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--warning)' }}>
                      {formatRelativeTime(syncStatus.lastSyncAt) || formatDateTime(syncStatus.lastSyncAt)}
                    </span>
                  </div>
                )}

                {/* Next scheduled sync */}
                {config.enabled && config.syncIntervalMinutes > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Next scheduled sync</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                      {formatRelativeTime(syncStatus?.nextSyncAt) || formatDateTime(syncStatus?.nextSyncAt)}
                    </span>
                    {syncStatus?.nextSyncAt && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatDateTime(syncStatus.nextSyncAt)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              {syncStatus?.stats ? (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                }}>
                  <StatBadge label="Synced" value={syncStatus.stats.synced} icon={<Users size={14} />} color="var(--accent)" />
                  <StatBadge label="Created" value={syncStatus.stats.created} icon={<UserPlus size={14} />} color="var(--success)" />
                  <StatBadge label="Updated" value={syncStatus.stats.updated} icon={<RefreshCw size={14} />} color="var(--accent-mid)" />
                  <StatBadge label="Deactivated" value={syncStatus.stats.deactivated} icon={<XCircle size={14} />} color="var(--text-muted)" />
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '24px', background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', fontSize: '12px',
                }}>
                  <Database size={16} style={{ marginRight: 8 }} />
                  No sync statistics available yet
                </div>
              )}
            </div>

            {/* ── Sync Selected Users ── */}
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setShowSyncUsers(!showSyncUsers)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 16px',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                  Sync Selected Users
                </span>
                <span style={{
                  fontSize: '11px', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'transform 0.2s',
                  transform: showSyncUsers ? 'rotate(90deg)' : 'none',
                }}>
                  <ChevronRight size={14} />
                </span>
              </div>

              {showSyncUsers && (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Enter email addresses below to sync specific users from your directory.
                    Supports comma-separated, line-separated, or mixed formats. Max 20 at a time.
                  </div>
                  <textarea
                    className="input"
                    value={selectedEmails}
                    onChange={e => setSelectedEmails(e.target.value)}
                    placeholder={`user1@company.com\nuser2@company.com`}
                    rows={3}
                    style={{
                      width: '100%', resize: 'vertical', fontFamily: 'monospace',
                      fontSize: '12px', padding: '10px 12px',
                      lineHeight: 1.5,
                    }}
                    disabled={syncingUsers}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={handleSyncSelectedUsers}
                      disabled={syncingUsers || !selectedEmails.trim() || !oauthConnected}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '8px 18px', borderRadius: 'var(--radius-md)',
                        background: syncingUsers ? 'var(--bg-tertiary)' : 'var(--accent)',
                        color: syncingUsers ? 'var(--text-muted)' : 'white',
                        border: 'none', fontSize: '12px', fontWeight: 600,
                        cursor: syncingUsers ? 'wait' : 'pointer',
                        opacity: (!selectedEmails.trim() || !oauthConnected) ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {syncingUsers ? <RefreshCw size={13} className="ds-spin" /> : <Search size={13} />}
                      {syncingUsers ? 'Syncing...' : 'Sync Selected'}
                    </button>
                    {!oauthConnected && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Info size={11} />
                        Connect OAuth to enable sync
                      </span>
                    )}
                  </div>

                  {/* Sync Results */}
                  {syncUsersResults && (
                    <div className="ds-fade-in" style={{
                      marginTop: 4,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}>
                      {/* Summary row */}
                      <div style={{
                        display: 'flex', gap: 8, padding: '10px 14px',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '12px', fontWeight: 600,
                        flexWrap: 'wrap',
                      }}>
                        <span style={{ color: 'var(--success)' }}>{syncUsersResults.created} created</span>
                        <span style={{ color: 'var(--accent)' }}>{syncUsersResults.updated} updated</span>
                        <span style={{ color: 'var(--text-muted)' }}>{syncUsersResults.skipped} skipped</span>
                        <span style={{ color: 'var(--warning)' }}>{syncUsersResults.notFound} not found</span>
                        {syncUsersResults.errors > 0 && (
                          <span style={{ color: 'var(--danger)' }}>{syncUsersResults.errors} errors</span>
                        )}
                      </div>
                      {/* Results table */}
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <tbody>
                            {syncUsersResults.results.map((r, idx) => (
                              <tr key={idx} style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                background: r.status === 'error' ? 'var(--danger-bg)' : r.status === 'not_found' ? 'var(--warning-bg)' : undefined,
                              }}>
                                <td style={{ padding: '6px 14px', color: 'var(--text)', fontWeight: 500 }}>
                                  {r.email}
                                </td>
                                <td style={{ padding: '6px 14px' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                    fontSize: '11px', fontWeight: 600,
                                    background: r.status === 'created' ? 'var(--success-bg)' :
                                      r.status === 'updated' ? 'var(--accent-subtle)' :
                                      r.status === 'error' ? 'var(--danger-bg)' :
                                      r.status === 'not_found' ? 'var(--warning-bg)' :
                                      'var(--bg-tertiary)',
                                    color: r.status === 'created' ? 'var(--success)' :
                                      r.status === 'updated' ? 'var(--accent)' :
                                      r.status === 'error' ? 'var(--danger)' :
                                      r.status === 'not_found' ? 'var(--warning)' :
                                      'var(--text-muted)',
                                  }}>
                                    {r.status === 'created' && <UserPlus size={10} />}
                                    {r.status === 'updated' && <RefreshCw size={10} />}
                                    {r.status === 'error' && <XCircle size={10} />}
                                    {r.status === 'not_found' && <AlertTriangle size={10} />}
                                    {r.status === 'skipped' && <Info size={10} />}
                                    {r.status}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 14px', color: 'var(--text-muted)', fontSize: '11px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.error || r.name || ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ===== Sync History ===== */}
        <Section
          icon={<Database size={16} />}
          iconBg="var(--bg-tertiary)"
          iconColor="var(--text-secondary)"
          label="Sync History"
          description="Recent sync operations and their results"
          badge={syncLogs.length > 0 ? (
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
              fontSize: '10px', fontWeight: 600,
              background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>{syncLogs.length}</span>
          ) : undefined}
        >
          {syncLogs.length === 0 ? (
            <EmptyState
              icon={<Database size={24} />}
              title="No sync history yet"
              description="Run your first sync to see operation results and statistics here. Sync history helps you track provisioning activity and troubleshoot issues."
              action={
                oauthConnected ? (
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 'var(--radius-md)',
                      background: 'var(--accent)', color: 'white',
                      border: 'none', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={13} />
                    Run First Sync
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Started</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Completed</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Duration</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Users</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        <div>{formatRelativeTime(log.startedAt) || formatDateTime(log.startedAt)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatDateTime(log.startedAt)}</div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {formatDateTime(log.completedAt)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                        {formatDuration(log.duration)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          fontSize: '11px', fontWeight: 600,
                          background: log.status === 'success' ? 'var(--success-bg)' : log.status === 'error' ? 'var(--danger-bg)' : 'var(--accent-subtle)',
                          color: log.status === 'success' ? 'var(--success)' : log.status === 'error' ? 'var(--danger)' : 'var(--accent)',
                          border: `1px solid ${log.status === 'success' ? 'var(--success-border)' : log.status === 'error' ? 'var(--danger-border)' : 'var(--accent-border)'}`,
                          textTransform: 'capitalize',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          {log.status === 'success' && <CheckCircle size={10} />}
                          {log.status === 'error' && <XCircle size={10} />}
                          {log.status === 'in_progress' && <RefreshCw size={10} className="ds-spin" />}
                          {log.status === 'in_progress' ? 'In Progress' : log.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                        {log.stats ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }} title="Synced">{log.stats.synced}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            <span style={{ color: 'var(--success)', fontWeight: 600 }} title="Created">{log.stats.created}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            <span style={{ color: 'var(--accent-mid)', fontWeight: 600 }} title="Updated">{log.stats.updated}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }} title="Deactivated">{log.stats.deactivated}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.error ? (
                          <span style={{ fontSize: '12px', color: 'var(--danger)' }} title={log.error}>{log.error}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ===== Save Button ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} />
            Changes are saved to the server. Sync settings take effect on the next scheduled run.
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8,
              fontSize: '13px', fontWeight: 600,
              boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)',
            }}
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Helper Sub-components ---

function StatBadge({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 14px', background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
    }}>
      <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}
