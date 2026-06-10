'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Battery,
  Bookmark,
  Cable,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  Clock,
  Cpu,
  Disc,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  HardDrive,
  Laptop,
  Loader2,
  Monitor,
  MonitorOff,
  MoreHorizontal,
  Network,
  Package,
  Play,
  Power,
  PowerOff,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  ScreenShare,
  Search,
  Server,
  Shield,
  ShieldOff,
  Smartphone,
  Terminal,
  Trash2,
  Upload,
  Usb,
  User,
  Users,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useStore } from '@/lib/store';
import type {
  TabId,
  AssetDetail,
  AssetResponse,
  AssetHardware,
  AssetSoftware,
  AssetNetworkAdapter,
  AssetUser,
  AssetActivityEntry,
  AgentCommand,
  UsbDevice,
  AssetDisk,
  AssetDisplay,
  NoticeTone
} from '@/lib/asset-detail-types';
import { TABS, DISPLAY_FONT, BODY_FONT, COMMAND_TYPES } from '@/lib/asset-detail-types';

import {
  Panel,
  DetailGrid,
  ProgressBar,
  Pill,
  ActionButton,
  EmptyState,
  OwnershipEditModal,
  AboutEditModal,
  TagsEditModal,
  EncryptionCard,
  BatteryCard,
  UsbDevicesPanel,
  CommandsPanel,
  RunCommandDialog
} from '@/components/asset-detail-ui';
import { AssetDetailSidebar } from '@/components/asset-detail-sidebar';
import {
  formatDate,
  formatDateTime,
  timeAgo,
  formatCurrency,
  formatBytes,
  formatGb,
  clampPercent,
  normalizeDns,
  getAssetIcon,
  getActivityMeta,
  toneColor,
  getDiskSummary,
  useSocketConnection,
  useCompactLayout
} from '@/components/asset-detail-utils';

// ---- Styles ----

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  fontFamily: BODY_FONT
};

const headerStyle: CSSProperties = {
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 30
};

const headerInnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 24px',
  maxWidth: 1440,
  margin: '0 auto'
};

const headerLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16
};

const headerRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10
};

const backButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 140ms ease'
};

const assetTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--text)',
  letterSpacing: '-0.02em',
  fontFamily: DISPLAY_FONT,
  lineHeight: 1.2
};

const assetSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  marginTop: 2
};

const tabsContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '0 24px',
  maxWidth: 1440,
  margin: '0 auto',
  overflowX: 'auto',
  scrollbarWidth: 'none'
};

const tabButtonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'color 140ms ease, background 140ms ease, border-color 140ms ease',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  marginBottom: -1
};

const tabButtonActive: CSSProperties = {
  ...tabButtonBase,
  color: 'var(--accent)',
  borderBottomColor: 'var(--accent)',
  background: 'var(--accent-subtle)'
};

const contentAreaStyle: CSSProperties = {
  display: 'flex',
  gap: 24,
  padding: 24,
  maxWidth: 1440,
  margin: '0 auto'
};

const mainContentStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  minWidth: 0
};

const sidebarStyle: CSSProperties = {
  width: 380,
  flexShrink: 0
};

const spinnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 24px',
  color: 'var(--text-muted)',
  gap: 12,
  fontSize: 14,
  fontWeight: 600
};

const errorContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 24px',
  gap: 16
};

const searchInputStyle: CSSProperties = {
  width: '100%',
  height: 42,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  padding: '0 12px 0 40px',
  fontSize: 13,
  fontFamily: BODY_FONT,
  outline: 'none',
  boxSizing: 'border-box'
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
  fontFamily: DISPLAY_FONT,
  letterSpacing: '-0.01em',
  marginBottom: 16
};

const grid2Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16
};

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-subtle)',
  border: '1px solid var(--border)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 600
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '0'
};

// ---- Interfaces ----

interface Script {
  id: string;
  name: string;
  description?: string;
  category?: string;
  target_os?: string;
  script_type?: string;
  script_content?: string;
  parameters?: any[];
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

interface AgentVersion {
  id: string;
  version: string;
  download_url?: string;
  release_notes?: string;
  created_at: string;
}

// ---- Page Component ----

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { user } = useStore();
  const isOnline = useSocketConnection();
  const compactLayout = useCompactLayout(1120);

  const canManage = ['admin', 'agent'].includes(user?.role || '');

  // Asset data
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Software
  const [software, setSoftware] = useState<AssetSoftware[]>([]);
  const [softwareSearch, setSoftwareSearch] = useState('');
  const [softwareLoading, setSoftwareLoading] = useState(false);

  // Scripts
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);

  // Commands
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);

  // Agent version
  const [agentVersion, setAgentVersion] = useState<AgentVersion | null>(null);

  // Script dialog
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [scriptForm, setScriptForm] = useState({ name: '', description: '', script_type: 'powershell', script_content: '' });
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptError, setScriptError] = useState('');

  // Collapsible sections
  const [sessionsExpanded, setSessionsExpanded] = useState(false);

  // Detail modals
  const [selectedCommand, setSelectedCommand] = useState<AgentCommand | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<AssetActivityEntry | null>(null);

  // UI state
  const [editOpen, setEditOpen] = useState(false);
  const [aboutEditOpen, setAboutEditOpen] = useState(false);
  const [tagsEditOpen, setTagsEditOpen] = useState(false);
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // ---- Data Fetching ----

  const fetchAsset = useCallback(async () => {
    try {
      const response = await api.get<AssetResponse>(`/assets/${id}`);
      const data = response?.data || response;
      setAsset(data as AssetDetail);
      setNotes((data as AssetDetail)?.notes || '');
      return data as AssetDetail;
    } catch (err: any) {
      setError(err?.message || 'Failed to load asset');
      return null;
    }
  }, [id]);

  const fetchSoftware = useCallback(async () => {
    setSoftwareLoading(true);
    try {
      const response = await api.get<{ data: AssetSoftware[] }>(`/assets/${id}/software`);
      const list = response?.data || response || [];
      setSoftware(Array.isArray(list) ? list : []);
    } catch {
      setSoftware([]);
    } finally {
      setSoftwareLoading(false);
    }
  }, [id]);

  const fetchScripts = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const response = await api.get<{ data: Script[] }>('/scripts');
      const list = response?.data || response || [];
      setScripts(Array.isArray(list) ? list : []);
    } catch {
      setScripts([]);
    } finally {
      setScriptsLoading(false);
    }
  }, []);

  const fetchCommands = useCallback(async () => {
    setCommandsLoading(true);
    try {
      const response = await api.get<{ data: AgentCommand[] }>(`/assets/${id}/commands`);
      const list = response?.data || response || [];
      setCommands(Array.isArray(list) ? list : []);
    } catch {
      setCommands([]);
    } finally {
      setCommandsLoading(false);
    }
  }, [id]);

  // Lightweight poll that doesn't set loading state (for auto-refresh)
  const pollCommands = useCallback(async () => {
    try {
      const response = await api.get<{ data: AgentCommand[] }>(`/assets/${id}/commands`);
      const list = response?.data || response || [];
      setCommands(Array.isArray(list) ? list : []);
    } catch {
      // Silently ignore polling errors
    }
  }, [id]);

  const fetchAgentVersion = useCallback(async () => {
    try {
      const response = await api.get<{ data: AgentVersion }>('/agent-versions/latest');
      const data = response?.data || response;
      if (data && typeof data === 'object' && 'id' in data) {
        setAgentVersion(data as AgentVersion);
      }
    } catch {
      // Agent version is not critical, silently skip
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const assetData = await fetchAsset();

    if (assetData) {
      await Promise.all([
        fetchSoftware(),
        fetchScripts(),
        fetchCommands(),
        fetchAgentVersion()
      ]);
    }

    setLoading(false);
  }, [fetchAsset, fetchSoftware, fetchScripts, fetchCommands, fetchAgentVersion]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh commands every 8s while active (pending/dispatched/in_progress) — no loading flicker
  useEffect(() => {
    if (!commands) return;
    const hasActive = commands.some(c => c.status === 'pending' || c.status === 'dispatched' || c.status === 'in_progress');
    if (!hasActive) return;
    const interval = setInterval(pollCommands, 8000);
    return () => clearInterval(interval);
  }, [commands, pollCommands]);

  // ---- Toast ----

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ---- Notes Saving ----

  const saveNotes = useCallback(async () => {
    if (!asset) return;
    setSavingNotes(true);
    try {
      await api.patch(`/assets/${asset.id}`, { notes });
      setToast({ message: 'Notes saved', tone: 'success' });
    } catch {
      setToast({ message: 'Failed to save notes', tone: 'error' });
    } finally {
      setSavingNotes(false);
    }
  }, [asset, notes]);

  // ---- Socket Presence ----

  const socket = useSocketConnection();

  useEffect(() => {
    if (!socket || !asset) return;

    const room = `asset:${asset.id}`;
    socket.emit('join', room);

    return () => {
      socket.emit('leave', room);
    };
  }, [socket, asset]);

  // ---- Helpers ----

  const isAssetOnline = asset?.agent_status === 'online';

  const statusColor = isAssetOnline ? 'var(--success, #22c55e)' : 'var(--text-muted)';
  const statusLabel = isAssetOnline ? 'Online' : 'Offline';

  const agentDotColor = isAssetOnline ? '#22c55e' : '#9ca3af';

  const filteredSoftware = useMemo(() => {
    if (!softwareSearch.trim()) return software;
    const q = softwareSearch.toLowerCase();
    return software.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const publisher = (s.publisher || '').toLowerCase();
      const version = (s.version || '').toLowerCase();
      return name.includes(q) || publisher.includes(q) || version.includes(q);
    });
  }, [software, softwareSearch]);

  const diskSummary = useMemo(() => getDiskSummary(asset?.hardware), [asset?.hardware]);

  // ---- Derived Data ----

  const activityEntries = asset?.activity || [];
  const networkAdapters = asset?.network_adapters || [];
  const usersList = asset?.logged_users || asset?.users || [];

  // Deduplicate users by username — keep the most recent session per user
  const deduplicatedUsers = useMemo(() => {
    const seen = new Map<string, typeof usersList[0]>();
    for (const u of usersList) {
      const key = u.username || u.user_email || u.id || 'unknown';
      const existing = seen.get(key);
      if (!existing || (u.logged_in_at && (!existing.logged_in_at || u.logged_in_at > existing.logged_in_at))) {
        seen.set(key, u);
      }
    }
    return Array.from(seen.values());
  }, [usersList]);

  // Most recently logged-in user (by logged_in_at) for the "Assigned to" field
  const mostRecentUserName = useMemo(() => {
    if (!usersList || usersList.length === 0) return null;
    const withTime = usersList.filter(u => u.logged_in_at);
    if (withTime.length === 0) return null;
    withTime.sort((a, b) => new Date(b.logged_in_at!).getTime() - new Date(a.logged_in_at!).getTime());
    return withTime[0].display_name || withTime[0].username || null;
  }, [usersList]);
  const usbDevices = asset?.usb_devices || [];

  // ---- Run Script ----

  const runScript = useCallback(async (script: Script) => {
    if (!asset) return;
    try {
      await api.post(`/assets/${asset.id}/commands`, {
        command_type: 'run_script',
          payload: {
            script: script.script_content || '',
            type: script.script_type || 'powershell'
          },
        priority: 50,
        timeout_seconds: 120
      });
      setToast({ message: `Script "${script.name}" dispatched`, tone: 'success' });
      fetchCommands();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to dispatch script', tone: 'error' });
    }
  }, [asset, fetchCommands]);

  // ---- Save / Delete Script ----

  const openNewScript = useCallback(() => {
    setEditingScript(null);
    setScriptForm({ name: '', description: '', script_type: 'powershell', script_content: '' });
    setScriptError('');
    setScriptDialogOpen(true);
  }, []);

  const openEditScript = useCallback((script: Script) => {
    setEditingScript(script);
    setScriptForm({
      name: script.name,
      description: script.description || '',
      script_type: script.script_type || 'powershell',
      script_content: script.script_content || ''
    });
    setScriptError('');
    setScriptDialogOpen(true);
  }, []);

  const saveScript = useCallback(async () => {
    if (!scriptForm.name.trim()) { setScriptError('Name is required'); return; }
    if (!scriptForm.script_content.trim()) { setScriptError('Script content is required'); return; }
    setScriptSaving(true);
    setScriptError('');
    try {
      const body = {
        name: scriptForm.name.trim(),
        description: scriptForm.description.trim() || undefined,
        script_type: scriptForm.script_type,
        script_content: scriptForm.script_content,
        category: 'general',
        target_os: 'windows'
      };
      if (editingScript) {
        await api.patch(`/scripts/${editingScript.id}`, body);
        setToast({ message: 'Script updated', tone: 'success' });
      } else {
        await api.post('/scripts', body);
        setToast({ message: 'Script created', tone: 'success' });
      }
      setScriptDialogOpen(false);
      fetchScripts();
    } catch (err: any) {
      setScriptError(err?.message || 'Failed to save script');
    } finally {
      setScriptSaving(false);
    }
  }, [scriptForm, editingScript, fetchScripts]);

  const deleteScript = useCallback(async (script: Script) => {
    if (!confirm(`Delete script "${script.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/scripts/${script.id}`);
      setToast({ message: `Script "${script.name}" deleted`, tone: 'success' });
      fetchScripts();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to delete script', tone: 'error' });
    }
  }, [fetchScripts]);

  // ---- Render ----

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={spinnerStyle}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          Loading asset details...
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <div style={headerInnerStyle}>
            <div style={headerLeftStyle}>
              <button onClick={() => router.back()} style={backButtonStyle}>
                <ArrowLeft size={18} />
              </button>
              <div>
                <div style={assetTitleStyle}>Asset not found</div>
              </div>
            </div>
          </div>
        </div>
        <div style={errorContainerStyle}>
          <AlertTriangle size={48} color="var(--danger)" />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {error || 'The requested asset could not be found.'}
          </div>
          <ActionButton icon={RotateCcw} tone="primary" onClick={loadAll}>
            Retry
          </ActionButton>
        </div>
      </div>
    );
  }

  const AssetIcon = getAssetIcon(asset?.asset_type);

  return (
    <div style={pageStyle}>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 100,
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${toast.tone === 'success' ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)'}`,
            background: toast.tone === 'success' ? '#f0fdf4' : '#fef2f2',
            color: toast.tone === 'success' ? '#166534' : '#991b1b',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'fadeIn 200ms ease'
          }}
        >
          {toast.tone === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Ownership edit modal */}
      {editOpen && (
        <OwnershipEditModal
          asset={{
            ...asset,
            assigned_to_name: mostRecentUserName || asset.assigned_to_name || ''
          }}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setAsset(next);
            setToast({ message: 'Asset updated', tone: 'success' });
          }}
        />
      )}

      {/* About edit modal */}
      {aboutEditOpen && (
        <AboutEditModal
          asset={asset}
          onClose={() => setAboutEditOpen(false)}
          onSaved={(next) => {
            setAsset(next);
            setToast({ message: 'Display name updated', tone: 'success' });
          }}
        />
      )}

      {/* Tags edit modal */}
      {tagsEditOpen && (
        <TagsEditModal
          asset={asset}
          onClose={() => setTagsEditOpen(false)}
          onSaved={(next) => {
            setAsset(next);
            setToast({ message: 'Tags updated', tone: 'success' });
          }}
        />
      )}

      {/* Command dialog */}
      {commandDialogOpen && (
        <RunCommandDialog
          assetId={asset.id}
          onClose={() => setCommandDialogOpen(false)}
          onCreated={() => {
            setCommandDialogOpen(false);
            fetchCommands();
            setToast({ message: 'Command sent', tone: 'success' });
          }}
        />
      )}

      {/* Script dialog */}
      {scriptDialogOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)'
          }}
          onClick={() => setScriptDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560, maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: DISPLAY_FONT }}>
                {editingScript ? 'Edit Script' : 'New Script'}
              </div>
              <button
                onClick={() => setScriptDialogOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {scriptError && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
                  {scriptError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Script Name</label>
                <input
                  type="text"
                  value={scriptForm.name}
                  onChange={(e) => setScriptForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Disk Cleanup"
                  style={{
                    width: '100%', height: 42, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)', padding: '0 12px', fontSize: 13, fontFamily: BODY_FONT, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
                <textarea
                  value={scriptForm.description}
                  onChange={(e) => setScriptForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description of what this script does"
                  rows={2}
                  style={{
                    width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)', padding: '10px 12px', fontSize: 13, fontFamily: BODY_FONT, boxSizing: 'border-box', resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Script Type</label>
                <select
                  value={scriptForm.script_type}
                  onChange={(e) => setScriptForm(f => ({ ...f, script_type: e.target.value }))}
                  style={{
                    width: '100%', height: 42, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)', padding: '0 12px', fontSize: 13, fontFamily: BODY_FONT, boxSizing: 'border-box'
                  }}
                >
                  <option value="powershell">PowerShell</option>
                  <option value="cmd">CMD</option>
                  <option value="batch">Batch</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Script Content</label>
                <textarea
                  value={scriptForm.script_content}
                  onChange={(e) => setScriptForm(f => ({ ...f, script_content: e.target.value }))}
                  placeholder="Write your script here..."
                  rows={10}
                  style={{
                    width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)', padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical',
                    lineHeight: 1.5
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setScriptDialogOpen(false)}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveScript}
                disabled={scriptSaving}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)',
                  background: 'var(--accent)', color: 'var(--text-inverse)', fontSize: 13, fontWeight: 700,
                  cursor: scriptSaving ? 'not-allowed' : 'pointer', opacity: scriptSaving ? 0.6 : 1, fontFamily: BODY_FONT,
                  display: 'inline-flex', alignItems: 'center', gap: 8
                }}
              >
                {scriptSaving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editingScript ? 'Save Changes' : 'Create Script'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Command Detail Modal ── */}
      {selectedCommand && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelectedCommand(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{COMMAND_TYPES.find(t => t.value === selectedCommand.command_type)?.icon || '⚡'}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: DISPLAY_FONT }}>
                    {COMMAND_TYPES.find(t => t.value === selectedCommand.command_type)?.label || selectedCommand.command_type}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCommand(null)} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Status</span>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: selectedCommand.status === 'completed' ? '#dcfce7' : selectedCommand.status === 'failed' ? '#fef2f2' : selectedCommand.status === 'cancelled' ? '#f3f4f6' : selectedCommand.status === 'dispatched' ? '#dbeafe' : '#fef9c3',
                  color: selectedCommand.status === 'completed' ? '#166534' : selectedCommand.status === 'failed' ? '#991b1b' : selectedCommand.status === 'cancelled' ? '#6b7280' : selectedCommand.status === 'dispatched' ? '#1e40af' : '#854d0e'
                }}>
                  {selectedCommand.status === 'completed' && selectedCommand.exit_code === 0 ? 'Completed' : selectedCommand.status.charAt(0).toUpperCase() + selectedCommand.status.slice(1)}
                </span>
                {selectedCommand.exit_code != null && (
                  <span style={{ fontSize: 12, color: selectedCommand.exit_code === 0 ? '#166534' : '#991b1b' }}>
                    Exit code: {selectedCommand.exit_code}
                  </span>
                )}
              </div>

              {/* Agent-offline warning for pending commands */}
              {selectedCommand.status === 'pending' && asset?.agent_status !== 'online' && (
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: '#fef9c3', border: '1px solid #fde68a',
                  display: 'flex', alignItems: 'flex-start', gap: 10
                }}>
                  <Clock size={16} color='#854d0e' style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', marginBottom: 2 }}>Agent Offline</div>
                    <div style={{ fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>
                      This command won't run until the agent connects. Deploy the agent to this machine and it will pick up pending commands automatically.
                    </div>
                  </div>
                </div>
              )}

              {/* Stale-dispatched warning — command was picked up by agent but never reported back */}
              {selectedCommand.status === 'dispatched' && selectedCommand.dispatched_at && (() => {
                const elapsed = Date.now() - new Date(selectedCommand.dispatched_at).getTime();
                if (elapsed < 120000) return null; // Only warn after 2+ minutes
                return (
                  <div style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: '#fef9c3', border: '1px solid #fde68a',
                    display: 'flex', alignItems: 'flex-start', gap: 10
                  }}>
                    <AlertTriangle size={16} color='#b45309' style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 2 }}>Command appears stuck</div>
                      <div style={{ fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>
                        The agent picked up this command {Math.round(elapsed / 1000)}s ago but hasn't reported a result.
                        The agent process may have crashed or lost connectivity. You can force-cancel this command and retry.
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Timestamps */}
              {selectedCommand.created_at && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Timeline</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Created</span>
                      <span style={{ color: 'var(--text)' }}>{formatDateTime(selectedCommand.created_at)}</span>
                      {selectedCommand.created_by_name && <span style={{ color: 'var(--text-muted)' }}>by {selectedCommand.created_by_name}</span>}
                    </div>
                    {selectedCommand.dispatched_at && (
                      <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Dispatched</span>
                        <span style={{ color: 'var(--text)' }}>{formatDateTime(selectedCommand.dispatched_at)}</span>
                      </div>
                    )}
                    {selectedCommand.started_at && (
                      <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Started</span>
                        <span style={{ color: 'var(--text)' }}>{formatDateTime(selectedCommand.started_at)}</span>
                      </div>
                    )}
                    {selectedCommand.completed_at && (
                      <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Completed</span>
                        <span style={{ color: 'var(--text)' }}>{formatDateTime(selectedCommand.completed_at)}</span>
                        {selectedCommand.dispatched_at && (
                          <span style={{ color: 'var(--text-muted)' }}>
                            (Duration: {Math.round((new Date(selectedCommand.completed_at).getTime() - new Date(selectedCommand.dispatched_at).getTime()) / 1000)}s)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error message */}
              {selectedCommand.error_message && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#991b1b', marginBottom: 6 }}>Error</div>
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {selectedCommand.error_message}
                  </div>
                </div>
              )}

              {/* Payload */}
              {selectedCommand.payload && Object.keys(selectedCommand.payload).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Payload</div>
                  <pre style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', lineHeight: 1.5, color: 'var(--text)' }}>
                    {(() => {
                      try {
                        const p = selectedCommand.payload;
                        if (typeof p === 'object') {
                          // For run_script, show script content prominently
                          if (selectedCommand.command_type === 'run_script' && p.script) {
                            return `Script: ${p.script_type || 'powershell'}\n${'─'.repeat(40)}\n${p.script}`;
                          }
                          return JSON.stringify(p, null, 2);
                        }
                        return String(p);
                      } catch { return String(selectedCommand.payload); }
                    })()}
                  </pre>
                </div>
              )}

              {/* Stdout */}
              {selectedCommand.stdout && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Output (stdout)</div>
                    <button onClick={() => { navigator.clipboard.writeText(selectedCommand.stdout || ''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}>
                      Copy
                    </button>
                  </div>
                  <pre style={{ padding: 12, borderRadius: 'var(--radius-md)', background: selectedCommand.status === 'failed' ? '#fef2f2' : '#f9fafb', border: '1px solid #e5e7eb', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', lineHeight: 1.5, color: 'var(--text)' }}>
                    {selectedCommand.stdout}
                  </pre>
                </div>
              )}

              {/* Stderr */}
              {selectedCommand.stderr && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#991b1b' }}>Error Output (stderr)</div>
                    <button onClick={() => { navigator.clipboard.writeText(selectedCommand.stderr || ''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}>
                      Copy
                    </button>
                  </div>
                  <pre style={{ padding: 12, borderRadius: 'var(--radius-md)', background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', lineHeight: 1.5, color: '#991b1b' }}>
                    {selectedCommand.stderr}
                  </pre>
                </div>
              )}

              {/* Config info */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Priority: </span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedCommand.priority}</span>
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Timeout: </span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedCommand.timeout_seconds}s</span>
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Max retries: </span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedCommand.max_retries}</span>
                </div>
                {selectedCommand.expires_at && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Expires: </span>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatDateTime(selectedCommand.expires_at)}</span>
                  </div>
                )}
                {selectedCommand.retry_count > 0 && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Retries: </span>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedCommand.retry_count}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Detail Modal ── */}
      {selectedActivity && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelectedActivity(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: 'calc(100vw - 32px)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {(() => {
                  const meta = getActivityMeta(selectedActivity.action);
                  const IconComp = meta.icon;
                  return <IconComp size={18} color={toneColor(meta.tone)} />;
                })()}
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: DISPLAY_FONT }}>
                  {selectedActivity.action}
                </div>
              </div>
              <button onClick={() => setSelectedActivity(null)} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Action</div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{selectedActivity.action}</div>
              </div>
              {selectedActivity.details && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Details</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{selectedActivity.details}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Timestamp</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {selectedActivity.created_at ? formatDateTime(selectedActivity.created_at) : '—'}
                </div>
              </div>
              {selectedActivity.actor_name && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Actor</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{selectedActivity.actor_name}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={headerStyle}>
        <div style={headerInnerStyle}>
          <div style={headerLeftStyle}>
            <button onClick={() => router.back()} style={backButtonStyle}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={assetTitleStyle}>{asset.hostname || asset.name || 'Unnamed Asset'}</div>
              <div style={assetSubtitleStyle}>
                {asset.asset_type ? asset.asset_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Asset'}
                {asset.serial_number && ` \u00B7 SN: ${asset.serial_number}`}
              </div>
            </div>
          </div>

          <div style={headerRightStyle}>
            {/* Agent status indicator */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: 12,
                fontWeight: 700,
                color: statusColor
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: agentDotColor,
                  boxShadow: isAssetOnline ? `0 0 6px ${agentDotColor}` : 'none'
                }}
              />
              {statusLabel}
            </div>

            {canManage && (
              <ActionButton icon={Terminal} onClick={() => setCommandDialogOpen(true)}>
                Command
              </ActionButton>
            )}

            <ActionButton icon={RefreshCw} onClick={loadAll}>
              Refresh
            </ActionButton>
          </div>
        </div>

        {/* Tabs */}
        <div style={tabsContainerStyle}>
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={isActive ? tabButtonActive : tabButtonBase}
              >
                <TabIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div style={contentAreaStyle}>
        {/* Main content */}
        <div style={mainContentStyle}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'hardware' && renderHardware()}
          {activeTab === 'software' && renderSoftware()}
          {activeTab === 'automation' && renderAutomation()}
          {activeTab === 'network' && renderNetwork()}
          {activeTab === 'activity' && renderActivity()}
          {activeTab === 'security' && renderSecurity()}
        </div>

        {/* Sidebar */}
        {!compactLayout && (
          <div style={sidebarStyle}>
            <AssetDetailSidebar
              asset={asset}
              compactLayout={compactLayout}
              isOnline={isAssetOnline}
              lastSeen={asset.agent_last_seen}
              notes={notes}
              setNotes={setNotes}
              savingNotes={savingNotes}
              saveNotes={saveNotes}
              users={deduplicatedUsers}
              software={software}
              activity={activityEntries}
            />
          </div>
        )}
      </div>
    </div>
  );

  // ---- Overview Tab ----

  function renderOverview(): ReactNode {
    if (!asset) return null;
    return (
      <>
        {/* About this asset */}
        <Panel
          title="About this asset"
          subtitle="Identity, ownership, and lifecycle"
          icon={Monitor}
          actions={canManage ? (
            <ActionButton icon={Edit3} onClick={() => setAboutEditOpen(true)}>
              Edit
            </ActionButton>
          ) : undefined}
        >
          <DetailGrid
            columns={3}
            items={[
              { label: 'Display name', value: asset.display_name || '\u2014' },
              { label: 'Hostname', value: asset.hostname || '\u2014' },
              { label: 'Asset type', value: asset.asset_type ? asset.asset_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '\u2014' },
              { label: 'Serial number', value: asset.serial_number || '\u2014' },
              { label: 'Manufacturer', value: asset.manufacturer || '\u2014' },
              { label: 'Model', value: asset.model || '\u2014' },
              { label: 'IP address', value: asset.ip_address || '\u2014' },
              { label: 'MAC address', value: asset.mac_address || '\u2014' },
              { label: 'Domain', value: asset.domain || '\u2014' },
              { label: 'OS', value: asset.os_name ? `${asset.os_name}${asset.os_version ? ` ${asset.os_version}` : ''}` : '\u2014' },
              { label: 'Agent version', value: asset.agent_version || '\u2014' },
              { label: 'Last seen', value: asset.agent_last_seen ? timeAgo(asset.agent_last_seen) : '\u2014' }
            ]}
          />
        </Panel>

        {/* Ownership & Lifecycle */}
        <Panel
          title="Ownership & Lifecycle"
          subtitle="Assignment and procurement details"
          icon={User}
          actions={canManage ? (
            <ActionButton icon={Edit3} onClick={() => setEditOpen(true)}>
              Edit
            </ActionButton>
          ) : undefined}
        >
          <DetailGrid
            columns={3}
            items={[
              { label: 'Assigned to', value: mostRecentUserName || asset.assigned_to_name || '\u2014' },
              { label: 'Owner', value: asset.owner_name || '\u2014' },
              { label: 'Department', value: asset.department || '\u2014' },
              { label: 'Location', value: asset.location || '\u2014' },
              { label: 'Company', value: asset.company || '\u2014' },
              { label: 'Vendor', value: asset.vendor || '\u2014' },
              { label: 'Purchase date', value: asset.purchase_date ? formatDate(asset.purchase_date) : '\u2014' },
              { label: 'Warranty expiry', value: asset.warranty_expiry ? formatDate(asset.warranty_expiry) : '\u2014' },
              { label: 'Purchase cost', value: asset.purchase_cost != null ? formatCurrency(asset.purchase_cost) : '\u2014', accent: true }
            ]}
          />
        </Panel>

        {/* Tags */}
        {(asset.tags && asset.tags.length > 0) || canManage ? (
          <Panel
            title="Tags"
            subtitle="Labels and categories"
            icon={Bookmark}
            actions={canManage ? (
              <ActionButton icon={Edit3} onClick={() => setTagsEditOpen(true)}>
                Edit
              </ActionButton>
            ) : undefined}
          >
            {asset.tags && asset.tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {asset.tags.map((tag) => (
                  <span key={tag} style={tagStyle}>{tag}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                No tags yet.
              </div>
            )}
          </Panel>
        ) : null}

        {/* Software Summary */}
        {software.length > 0 && (
          <Panel
            title="Software Summary"
            subtitle={`${software.length} package${software.length !== 1 ? 's' : ''} installed`}
            icon={Package}
            actions={
              <ActionButton onClick={() => setActiveTab('software')}>
                View all
              </ActionButton>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {software.slice(0, 8).map((s) => (
                <div
                  key={s.id || s.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.version || '\u2014'}
                    {s.publisher && ` \u00B7 ${s.publisher}`}
                  </div>
                </div>
              ))}
              {software.length > 8 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontWeight: 600
                  }}
                >
                  +{software.length - 8} more package{software.length - 8 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Recent Activity */}
        {activityEntries.length > 0 && (
          <Panel
            title="Recent Activity"
            subtitle="Latest events on this asset"
            icon={Activity}
            actions={
              <ActionButton onClick={() => setActiveTab('activity')}>
                View all
              </ActionButton>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activityEntries.slice(0, 5).map((entry) => {
                const meta = getActivityMeta(entry.action);
                const IconComp = meta.icon;
                return (
                  <div
                    key={entry.id || entry.created_at}
                    onClick={() => setSelectedActivity(entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComp size={14} color={toneColor(meta.tone)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {entry.action}
                      </div>
                      {entry.details && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {entry.details}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {entry.actor_name ? `${entry.actor_name} \u00B7 ` : ''}
                        {entry.created_at ? timeAgo(entry.created_at) : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* Notes shown inline when no sidebar */}
        {compactLayout && (
          <Panel title="Notes" subtitle="Internal asset notes" icon={FileText}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this asset..."
              rows={4}
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                padding: '12px',
                fontSize: 13,
                fontFamily: BODY_FONT,
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <ActionButton icon={Save} tone="primary" disabled={savingNotes} onClick={saveNotes}>
                {savingNotes ? 'Saving\u2026' : 'Save Notes'}
              </ActionButton>
            </div>
          </Panel>
        )}
      </>
    );
  }

  // ---- Hardware Tab ----

  function renderHardware(): ReactNode {
    if (!asset) return null;
    const hw = asset.hardware;

    return (
      <>
        {/* CPU */}
        <Panel title="Processor" subtitle="CPU specifications and utilization" icon={Cpu}>
          {hw?.cpu_model ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DetailGrid
                columns={3}
                items={[
                  { label: 'Model', value: hw.cpu_model },
                  { label: 'Cores', value: hw.cpu_cores != null ? String(hw.cpu_cores) : '\u2014' },
                  { label: 'Threads', value: hw.cpu_threads != null ? String(hw.cpu_threads) : '\u2014' },
                  { label: 'Speed', value: hw.cpu_speed_mhz != null ? `${hw.cpu_speed_mhz} MHz` : '\u2014' }
                ]}
              />
              {hw.cpu_usage_percent != null && (
                <ProgressBar
                  percent={clampPercent(hw.cpu_usage_percent)}
                  color={hw.cpu_usage_percent > 80 ? '#ef4444' : hw.cpu_usage_percent > 50 ? '#f59e0b' : '#3b82f6'}
                  label="CPU Usage"
                  meta={`${hw.cpu_usage_percent}%`}
                />
              )}
            </div>
          ) : (
            <EmptyState icon={Cpu} title="No CPU data" description="Processor details will appear after the next agent check-in." />
          )}
        </Panel>

        {/* RAM */}
        <Panel title="Memory" subtitle="RAM capacity and usage" icon={Disc}>
          {hw?.ram_total_gb != null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DetailGrid
                columns={3}
                items={[
                  { label: 'Total', value: formatGb(hw.ram_total_gb) },
                  { label: 'Used', value: formatGb(hw.ram_used_gb), accent: true },
                  { label: 'Free', value: formatGb(hw.ram_free_gb) }
                ]}
              />
              {hw.ram_used_gb != null && hw.ram_total_gb != null && hw.ram_total_gb > 0 && (
                <ProgressBar
                  percent={clampPercent((hw.ram_used_gb / hw.ram_total_gb) * 100)}
                  color="#3b82f6"
                  label="Memory Usage"
                  meta={`${formatGb(hw.ram_used_gb)} / ${formatGb(hw.ram_total_gb)}`}
                />
              )}
            </div>
          ) : (
            <EmptyState icon={Disc} title="No memory data" description="RAM details will appear after the next agent check-in." />
          )}
        </Panel>

        {/* Storage */}
        <Panel title="Storage" subtitle="Disk capacity and volumes" icon={HardDrive}>
          {diskSummary.total > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DetailGrid
                columns={3}
                items={[
                  { label: 'Total', value: formatGb(diskSummary.total) },
                  { label: 'Used', value: formatGb(diskSummary.used), accent: true },
                  { label: 'Free', value: formatGb(diskSummary.free) }
                ]}
              />
              {diskSummary.total > 0 && (
                <ProgressBar
                  percent={clampPercent((diskSummary.used / diskSummary.total) * 100)}
                  color={diskSummary.used / diskSummary.total > 0.85 ? '#ef4444' : '#22c55e'}
                  label="Disk Usage"
                  meta={`${formatGb(diskSummary.used)} / ${formatGb(diskSummary.total)}`}
                />
              )}

              {/* Individual disks */}
              {hw?.disks && hw.disks.length > 0 && (
                <>
                  <div style={dividerStyle} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Physical Disks</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {hw.disks.map((disk, idx) => (
                      <div
                        key={disk.name || `disk-${idx}`}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {disk.name || `Disk ${idx + 1}`}
                          </div>
                          {disk.size != null && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {formatBytes(disk.size)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                          {disk.vendor && <span>{disk.vendor}</span>}
                          {disk.type && <span>{disk.type}</span>}
                          {disk.serial_number && <span>SN: {disk.serial_number}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <EmptyState icon={HardDrive} title="No storage data" description="Disk details will appear after the next agent check-in." />
          )}
        </Panel>

        {/* GPU */}
        <Panel title="Graphics" subtitle="GPU specifications" icon={Monitor}>
          {hw?.gpu_model ? (
            <DetailGrid
              columns={2}
              items={[
                { label: 'GPU Model', value: hw.gpu_model },
                { label: 'VRAM', value: hw.gpu_vram_gb != null ? `${hw.gpu_vram_gb} GB` : '\u2014' }
              ]}
            />
          ) : (
            <EmptyState icon={Monitor} title="No GPU data" description="Graphics details will appear after the next agent check-in." />
          )}
        </Panel>

        {/* Motherboard / BIOS */}
        <Panel title="Motherboard & BIOS" subtitle="System board and firmware" icon={MonitorOff}>
          {hw?.motherboard_manufacturer || hw?.bios_version ? (
            <DetailGrid
              columns={2}
              items={[
                { label: 'Motherboard', value: hw.motherboard_manufacturer || '\u2014' },
                { label: 'BIOS Version', value: hw.bios_version || '\u2014' },
                { label: 'BIOS Release Date', value: hw.bios_release_date ? formatDate(hw.bios_release_date) : '\u2014' }
              ]}
            />
          ) : (
            <EmptyState icon={MonitorOff} title="No motherboard data" description="System board details will appear after the next agent check-in." />
          )}
        </Panel>

        {/* Displays */}
        {hw?.displays && hw.displays.length > 0 && (
          <Panel title="Displays" subtitle={`${hw.displays.length} monitor${hw.displays.length !== 1 ? 's' : ''} connected`} icon={Monitor}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hw.displays.map((display, idx) => (
                <div
                  key={display.name || `display-${idx}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {display.name || `Display ${idx + 1}`}
                    </div>
                    {display.is_primary && (
                      <Pill tone="success">Primary</Pill>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    {display.manufacturer && <span>{display.manufacturer}</span>}
                    {display.model && <span>{display.model}</span>}
                    {display.resolution && <span>{display.resolution}</span>}
                    {display.refresh_rate_hz != null && <span>{display.refresh_rate_hz} Hz</span>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Encryption */}
        {hw?.encryption_status && hw.encryption_status.length > 0 && (
          <Panel title="Encryption" subtitle="BitLocker drive encryption status" icon={Shield}>
            <EncryptionCard encryption={hw.encryption_status} />
          </Panel>
        )}

        {/* Battery */}
        {hw?.battery_has_battery != null && (
          <Panel title="Battery" subtitle="Power source health and status" icon={Battery}>
            <BatteryCard hw={hw} />
          </Panel>
        )}

        {/* USB Devices */}
        {usbDevices.length > 0 && (
          <Panel title="USB Devices" subtitle={`${usbDevices.length} device${usbDevices.length !== 1 ? 's' : ''} connected`} icon={Usb}>
            <UsbDevicesPanel devices={usbDevices} />
          </Panel>
        )}
      </>
    );
  }

  // ---- Software Tab ----

  function renderSoftware(): ReactNode {
    if (!asset) return null;
    return (
      <Panel
        title="Installed Software"
        subtitle={`${software.length} package${software.length !== 1 ? 's' : ''} installed`}
        icon={Package}
      >
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Search installed software..."
            value={softwareSearch}
            onChange={(e) => setSoftwareSearch(e.target.value)}
            style={searchInputStyle}
          />
          {softwareSearch && (
            <button
              onClick={() => setSoftwareSearch('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {softwareLoading ? (
          <div style={spinnerStyle}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Loading software...
          </div>
        ) : filteredSoftware.length === 0 ? (
          <EmptyState
            icon={Package}
            title={softwareSearch ? 'No matching software' : 'No software found'}
            description={softwareSearch ? 'Try a different search term.' : 'Installed software will appear here after the next agent check-in.'}
          />
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                {filteredSoftware.length} of {software.length} package{software.length !== 1 ? 's' : ''}
              </div>
              {filteredSoftware.map((s) => (
                <div
                  key={s.id || s.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 140ms ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Package size={16} color="var(--text-muted)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {s.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {s.version || '\u2014'}
                        {s.publisher && ` \u00B7 ${s.publisher}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 12 }}>
                    {s.install_date && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                        {formatDate(s.install_date)}
                      </div>
                    )}
                    {s.size_mb != null && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', minWidth: 60 }}>
                        {Number(s.size_mb) >= 1024 ? `${(Number(s.size_mb) / 1024).toFixed(1)} GB` : `${Number(s.size_mb).toFixed(0)} MB`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
      </Panel>
    );
  }

  // ---- Automation Tab ----

  function renderAutomation(): ReactNode {
    if (!asset) return null;
    return (
      <>
        {/* Commands Section */}
        <Panel
          title="Commands"
          subtitle="Sent and queued agent commands"
          icon={Terminal}
          actions={
            <ActionButton icon={Terminal} tone="primary" onClick={() => setCommandDialogOpen(true)}>
              New Command
            </ActionButton>
          }
        >
          {commandsLoading ? (
            <div style={spinnerStyle}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Loading commands...
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              <CommandsPanel
                commands={commands}
                onRefresh={fetchCommands}
                assetId={asset.id}
                onSelect={setSelectedCommand}
              />
            </div>
          )}
        </Panel>

        {/* Scripts Section */}
        <Panel
          title="Scripts"
          subtitle="Pre-defined scripts available for execution"
          icon={FileText}
          actions={
            canManage && (
              <div style={{ display: 'flex', gap: 8 }}>
                <ActionButton icon={RefreshCw} onClick={fetchScripts}>
                  Refresh
                </ActionButton>
                <ActionButton icon={FileText} tone="primary" onClick={openNewScript}>
                  New Script
                </ActionButton>
              </div>
            )
          }
        >
          {scriptsLoading ? (
            <div style={spinnerStyle}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Loading scripts...
            </div>
          ) : scripts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No scripts available"
              description="No scripts yet. Click 'New Script' to create one."
            />
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scripts.map((script) => (
                <div
                  key={script.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 140ms ease, box-shadow 140ms ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--accent-subtle)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <FileText size={16} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {script.name}
                      </div>
                      {script.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {script.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {script.script_type || 'powershell'}
                        {script.created_at && ` \u00B7 ${formatDate(script.created_at)}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    <button
                      onClick={() => runScript(script)}
                      disabled={!isAssetOnline}
                      title={isAssetOnline ? `Run "${script.name}"` : 'Agent is offline'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        height: 36,
                        padding: '0 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--accent)',
                        background: 'var(--accent)',
                        color: 'var(--text-inverse)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isAssetOnline ? 'pointer' : 'not-allowed',
                        opacity: isAssetOnline ? 1 : 0.5,
                        transition: 'opacity 140ms ease'
                      }}
                    >
                      <Play size={14} />
                      Run
                    </button>
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEditScript(script)}
                          title={`Edit "${script.name}"`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'background 140ms ease, color 140ms ease'
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteScript(script)}
                          title={`Delete "${script.name}"`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            transition: 'background 140ms ease'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </Panel>
      </>
    );
  }

  // ---- Network Tab ----

  function renderNetwork(): ReactNode {
    if (!asset) return null;
    return (
      <>
        {/* Network Adapters */}
        <Panel
          title="Network Adapters"
          subtitle={`${networkAdapters.length} adapter${networkAdapters.length !== 1 ? 's' : ''} detected`}
          icon={Network}
        >
          {networkAdapters.length === 0 ? (
            <EmptyState
              icon={Wifi}
              title="No network adapters"
              description="Network adapter information will appear after the next agent check-in."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {networkAdapters.map((adapter) => {
                const dnsServers = normalizeDns(adapter.dns_servers);
                return (
                  <div
                    key={adapter.id || adapter.name || adapter.mac_address}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg)',
                      border: `1px solid var(--border)`,
                      borderLeft: `3px solid ${adapter.is_active ? '#22c55e' : '#d1d5db'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          {adapter.name || adapter.adapter_name || 'Unknown Adapter'}
                        </div>
                        {adapter.is_virtual && (
                          <Pill tone="warning">Virtual</Pill>
                        )}
                        {adapter.is_active === false && (
                          <Pill tone="danger">Inactive</Pill>
                        )}
                      </div>
                      {adapter.speed_mbps != null && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {adapter.speed_mbps >= 1000
                            ? `${(adapter.speed_mbps / 1000).toFixed(1)} Gbps`
                            : `${adapter.speed_mbps} Mbps`}
                        </div>
                      )}
                    </div>

                    <DetailGrid
                      columns={2}
                      items={[
                        { label: 'IP Address', value: adapter.ip_address || '\u2014' },
                        { label: 'MAC Address', value: adapter.mac_address || '\u2014' },
                        { label: 'Subnet Mask', value: adapter.subnet_mask || adapter.subnet || '\u2014' },
                        { label: 'Gateway', value: adapter.gateway || '\u2014' },
                        { label: 'Type', value: adapter.adapter_type || '\u2014' }
                      ]}
                    />

                    {dnsServers.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                          DNS Servers
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {dnsServers.map((dns, idx) => (
                            <span
                              key={dns || idx}
                              style={{
                                padding: '2px 10px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                fontFamily: 'monospace'
                              }}
                            >
                              {dns}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </>
    );
  }

  // ---- Activity Tab ----

  function renderActivity(): ReactNode {
    if (!asset) return null;
    return (
      <Panel
        title="Activity Log"
        subtitle={`${activityEntries.length} event${activityEntries.length !== 1 ? 's' : ''} recorded`}
        icon={Activity}
        actions={
          <ActionButton icon={RefreshCw} onClick={fetchAsset}>
            Refresh
          </ActionButton>
        }
      >
        {activityEntries.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity recorded"
            description="Asset events and changes will appear here as they occur."
          />
        ) : (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activityEntries.map((entry, idx) => {
              const meta = getActivityMeta(entry.action);
              const IconComp = meta.icon;
              return (
                <div
                  key={entry.id || `activity-${idx}`}
                  onClick={() => setSelectedActivity(entry)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <IconComp size={16} color={toneColor(meta.tone)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {entry.action}
                        </div>
                        {entry.details && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                            {entry.details}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {entry.created_at ? formatDateTime(entry.created_at) : ''}
                      </div>
                    </div>
                    {entry.actor_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} />
                        {entry.actor_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </Panel>
    );
  }

  // ---- Security Tab ----

  function renderSecurity(): ReactNode {
    if (!asset) return null;
    const encryption = asset.hardware?.encryption_status || [];

    return (
      <>
        {/* User Sessions — collapsible */}
        <Panel
          title="User Sessions"
          subtitle={`${deduplicatedUsers.length} user${deduplicatedUsers.length !== 1 ? 's' : ''} logged in`}
          icon={Users}
          actions={
            deduplicatedUsers.length > 0 ? (
              <button
                onClick={() => setSessionsExpanded(!sessionsExpanded)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 32, padding: '0 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT
                }}
              >
                {sessionsExpanded ? 'Hide' : 'Show all'}
                <ChevronDown size={14} style={{ transform: sessionsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
              </button>
            ) : undefined
          }
        >
          {deduplicatedUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No active sessions"
              description="Logged-in users will appear here after the next agent check-in."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(sessionsExpanded ? deduplicatedUsers : deduplicatedUsers.slice(0, 3)).map((u) => (
                <div
                  key={u.id || u.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'var(--accent-subtle)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: 'var(--accent)', fontSize: 14, fontWeight: 700
                    }}
                  >
                    {(u.display_name || u.username || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {u.display_name || u.username || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {u.user_email && `${u.user_email}`}
                      {u.domain && u.username && (
                        <span> · {u.domain}\\{u.username}</span>
                      )}
                      {u.session_type && <span> · {u.session_type}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {u.is_current && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success, #22c55e)', marginBottom: 2 }}>
                        Current Session
                      </div>
                    )}
                    {u.logged_in_at && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {timeAgo(u.logged_in_at)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!sessionsExpanded && deduplicatedUsers.length > 3 && (
                <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  +{deduplicatedUsers.length - 3} more user{deduplicatedUsers.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Encryption */}
        {encryption.length > 0 && (
          <Panel title="Disk Encryption" subtitle="BitLocker status by volume" icon={Shield}>
            <EncryptionCard encryption={encryption} />
          </Panel>
        )}

        {/* USB Device History */}
        {usbDevices.length > 0 && (
          <Panel title="USB Device History" subtitle={`${usbDevices.length} device${usbDevices.length !== 1 ? 's' : ''} connected`} icon={Usb}>
            <UsbDevicesPanel devices={usbDevices} />
          </Panel>
        )}

        {/* Security Summary */}
        <Panel title="Security Summary" subtitle="Compliance and security posture" icon={Shield}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={16} color={encryption.length > 0 ? 'var(--success, #22c55e)' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Disk Encryption</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {encryption.length > 0 ? `${encryption.length} volume${encryption.length !== 1 ? 's' : ''} tracked` : 'No encryption data'}
                  </div>
                </div>
              </div>
              <Pill tone={encryption.length > 0 ? 'success' : 'warning'}>
                {encryption.length > 0 ? 'Monitoring' : 'No Data'}
              </Pill>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={16} color={usersList.length > 0 ? 'var(--accent)' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Active Sessions</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {usersList.length} user{usersList.length !== 1 ? 's' : ''} currently logged in
                  </div>
                </div>
              </div>
              <Pill tone={usersList.length > 0 ? 'info' : 'accent'}>
                {usersList.length} active
              </Pill>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Usb size={16} color={usbDevices.length > 0 ? 'var(--warning, #f59e0b)' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>USB Devices</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {usbDevices.length > 0 ? `${usbDevices.length} device${usbDevices.length !== 1 ? 's' : ''} detected` : 'No USB devices recorded'}
                  </div>
                </div>
              </div>
              <Pill tone={usbDevices.length > 0 ? 'warning' : 'accent'}>
                {usbDevices.length} device{usbDevices.length !== 1 ? 's' : ''}
              </Pill>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Power size={16} color={isAssetOnline ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)'} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Agent Status</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {isAssetOnline ? 'Agent is online and reporting' : `Offline since ${asset.agent_last_seen ? timeAgo(asset.agent_last_seen) : 'unknown'}`}
                  </div>
                </div>
              </div>
              <Pill tone={isAssetOnline ? 'success' : 'danger'}>
                {isAssetOnline ? 'Online' : 'Offline'}
              </Pill>
            </div>
          </div>
        </Panel>
      </>
    );
  }
}


