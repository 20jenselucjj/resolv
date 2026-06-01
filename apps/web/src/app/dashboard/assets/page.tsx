'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Laptop,
  Monitor,
  MoreHorizontal,
  Network,
  Package,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Server,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { SelectSearch } from '@/components/SelectSearch';

interface AssetHardware {
  cpu_usage_percent?: number | null;
  ram_used_gb?: number | null;
  ram_total_gb?: number | null;
}

interface Asset {
  id: string;
  name: string;
  display_name?: string;
  asset_type: string;
  status: string;
  agent_status: string;
  agent_last_seen?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  ip_address?: string;
  hostname?: string;
  os_name?: string;
  asset_group_id?: string | null;
  group_name?: string | null;
  group_color?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  assigned_to_avatar?: string | null;
  department?: string;
  location?: string;
  company?: string;
  vendor?: string;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  purchase_cost?: number | null;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  hardware?: AssetHardware | null;
  cpu_model?: string;
  ram_total_gb?: number;
}

interface AssetGroup {
  id: string;
  name: string;
  color: string;
  asset_count?: number;
}

interface StatsData {
  total: number;
  online: number;
  offline: number;
  by_status: Array<{ status: string; count: number }>;
  by_type: Array<{ asset_type: string; count: number }>;
}

interface AssetListResponse {
  data?: Asset[];
  assets?: Asset[];
  total?: number;
  page?: number;
  limit?: number;
}

interface AssetGroupsResponse {
  data?: AssetGroup[];
  groups?: AssetGroup[];
}

interface RawStatsResponse {
  data?: {
    total?: number;
    byStatus?: Array<{ status: string; count: number }>;
    byType?: Array<{ asset_type: string; count: number }>;
    agentStatus?: Array<{ agent_status: string; count: number }>;
  };
  total?: number;
  online?: number;
  offline?: number;
  by_status?: Array<{ status: string; count: number }>;
  by_type?: Array<{ asset_type: string; count: number }>;
}

interface AssetFormState {
  name: string;
  display_name: string;
  asset_type: string;
  status: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  ip_address: string;
  os_name: string;
  hostname: string;
  department: string;
  location: string;
  company: string;
  asset_group_id: string;
  vendor: string;
  purchase_date: string;
  warranty_expiry: string;
  purchase_cost: string;
  notes: string;
}

const PAGE_SIZE = 50;

const EMPTY_FORM: AssetFormState = {
  name: '',
  display_name: '',
  asset_type: 'workstation',
  status: 'active',
  serial_number: '',
  manufacturer: '',
  model: '',
  ip_address: '',
  os_name: '',
  hostname: '',
  department: '',
  location: '',
  company: '',
  asset_group_id: '',
  vendor: '',
  purchase_date: '',
  warranty_expiry: '',
  purchase_cost: '',
  notes: ''
};

const ASSET_TYPE_ICONS: Record<string, typeof Monitor> = {
  workstation: Monitor,
  laptop: Laptop,
  server: Server,
  mobile: Smartphone,
  printer: Printer,
  network_device: Network,
  other: Package
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  workstation: 'Workstation',
  laptop: 'Laptop',
  server: 'Server',
  mobile: 'Mobile',
  printer: 'Printer',
  network_device: 'Network Device',
  other: 'Other'
};

function timeAgo(date?: string): string {
  if (!date) return 'Never';

  const value = new Date(date).getTime();
  if (Number.isNaN(value)) return 'Never';

  const diffSeconds = Math.floor((Date.now() - value) / 1000);

  if (diffSeconds < 60) return 'Just now';

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;

  return new Date(date).toLocaleDateString();
}

function getTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTypeIcon(type: string): typeof Monitor {
  return ASSET_TYPE_ICONS[type] || Package;
}

function normalizeStats(response: RawStatsResponse): StatsData {
  if (response.data) {
    const online = response.data.agentStatus?.find((item) => item.agent_status === 'online')?.count || 0;
    const offline = response.data.agentStatus?.find((item) => item.agent_status === 'offline')?.count || 0;

    return {
      total: Number(response.data.total || 0),
      online,
      offline,
      by_status: response.data.byStatus || [],
      by_type: response.data.byType || []
    };
  }

  return {
    total: Number(response.total || 0),
    online: Number(response.online || 0),
    offline: Number(response.offline || 0),
    by_status: response.by_status || [],
    by_type: response.by_type || []
  };
}

function getHardware(asset: Asset): AssetHardware | null {
  if (asset.hardware) return asset.hardware;

  if (asset.cpu_model || asset.ram_total_gb) {
    return {
      ram_total_gb: asset.ram_total_gb
    };
  }

  return null;
}

function getCpuPercent(asset: Asset): number | null {
  const value = getHardware(asset)?.cpu_usage_percent;
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.max(0, Math.min(100, Number(value)));
}

function getRamPercent(asset: Asset): number | null {
  const hardware = getHardware(asset);
  if (!hardware || hardware.ram_total_gb == null || hardware.ram_used_gb == null || hardware.ram_total_gb <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, (Number(hardware.ram_used_gb) / Number(hardware.ram_total_gb)) * 100));
}

function getNeedsAttentionCount(stats: StatsData | null): number {
  if (!stats) return 0;
  const maintenance = stats.by_status.find((item) => item.status === 'maintenance')?.count || 0;
  const inactive = stats.by_status.find((item) => item.status === 'inactive')?.count || 0;
  return maintenance + inactive;
}

function getStatusTone(status: string): { background: string; color: string; border: string } {
  if (status === 'active') {
    return {
      background: 'color-mix(in srgb, var(--success) 14%, var(--bg-secondary))',
      color: 'var(--success)',
      border: 'color-mix(in srgb, var(--success) 24%, var(--border))'
    };
  }

  if (status === 'maintenance') {
    return {
      background: 'color-mix(in srgb, var(--warning) 14%, var(--bg-secondary))',
      color: 'var(--warning)',
      border: 'color-mix(in srgb, var(--warning) 24%, var(--border))'
    };
  }

  if (status === 'retired' || status === 'disposed') {
    return {
      background: 'color-mix(in srgb, var(--danger) 14%, var(--bg-secondary))',
      color: 'var(--danger)',
      border: 'color-mix(in srgb, var(--danger) 24%, var(--border))'
    };
  }

  return {
    background: 'color-mix(in srgb, var(--text-muted) 14%, var(--bg-secondary))',
    color: 'var(--text-muted)',
    border: 'color-mix(in srgb, var(--text-muted) 24%, var(--border))'
  };
}

function getAgentDotColor(status: string): string {
  if (status === 'online') return 'var(--success)';
  if (status === 'offline') return 'var(--text-muted)';
  return 'var(--warning)';
}

function getAgentLabel(asset: Asset): string {
  if (asset.agent_status === 'online') return 'Online';
  if (asset.agent_status === 'offline') {
    return asset.agent_last_seen ? `Offline • ${timeAgo(asset.agent_last_seen)}` : 'Offline';
  }
  return 'Unknown';
}

function buildPayload(form: AssetFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    display_name: form.display_name.trim() || undefined,
    asset_type: form.asset_type,
    status: form.status,
    serial_number: form.serial_number.trim() || undefined,
    manufacturer: form.manufacturer.trim() || undefined,
    model: form.model.trim() || undefined,
    ip_address: form.ip_address.trim() || undefined,
    os_name: form.os_name.trim() || undefined,
    hostname: form.hostname.trim() || undefined,
    department: form.department.trim() || undefined,
    location: form.location.trim() || undefined,
    company: form.company.trim() || undefined,
    asset_group_id: form.asset_group_id || undefined,
    vendor: form.vendor.trim() || undefined,
    purchase_date: form.purchase_date || undefined,
    warranty_expiry: form.warranty_expiry || undefined,
    purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : undefined,
    notes: form.notes.trim() || undefined
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === '') {
      delete payload[key];
    }
  });

  return payload;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toEditForm(asset: Asset): AssetFormState {
  return {
    name: asset.name || '',
    display_name: asset.display_name || '',
    asset_type: asset.asset_type || 'workstation',
    status: asset.status || 'active',
    serial_number: asset.serial_number || '',
    manufacturer: asset.manufacturer || '',
    model: asset.model || '',
    ip_address: asset.ip_address || '',
    os_name: asset.os_name || '',
    hostname: asset.hostname || '',
    department: asset.department || '',
    location: asset.location || '',
    company: asset.company || '',
    asset_group_id: asset.asset_group_id || '',
    vendor: asset.vendor || '',
    purchase_date: asset.purchase_date ? asset.purchase_date.slice(0, 10) : '',
    warranty_expiry: asset.warranty_expiry ? asset.warranty_expiry.slice(0, 10) : '',
    purchase_cost: asset.purchase_cost != null ? String(asset.purchase_cost) : '',
    notes: asset.notes || ''
  };
}

function Avatar({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  const initial = name?.trim()?.[0]?.toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name || 'Owner'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--accent-subtle)',
        border: '1px solid var(--accent-border)',
        color: 'var(--accent)',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0
      }}
    >
      {initial}
    </div>
  );
}

function ProgressMini({ value, tone }: { value: number | null; tone: string }) {
  if (value == null) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 72 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{Math.round(value)}%</div>
      <div
        style={{
          width: '100%',
          height: 6,
          borderRadius: 999,
          background: 'var(--bg-tertiary)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            borderRadius: 999,
            background: tone
          }}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Monitor;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `color-mix(in srgb, ${tone} 14%, var(--bg-secondary))`,
          color: tone,
          flexShrink: 0
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
        {label}
        {required ? <span style={{ color: 'var(--danger)' }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function AssetsPage() {
  const router = useRouter();
  const { user } = useStore();
  const canManage = ['admin', 'agent'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetFormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [filters, setFilters] = useState({
    asset_type: '',
    status: '',
    group_id: '',
    agent_status: ''
  });

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = PAGE_SIZE;

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 300);

    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [search]);

  useEffect(() => {
    function handleClose() {
      setMenuOpenId(null);
      setMenuPos(null);
    }

    if (!menuOpenId) return;

    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [menuOpenId]);

  const fetchAssets = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize)
        });

        if (debouncedSearch) params.set('search', debouncedSearch);
        if (filters.asset_type) params.set('asset_type', filters.asset_type);
        if (filters.status) params.set('status', filters.status);
        if (filters.group_id) params.set('group_id', filters.group_id);
        if (filters.agent_status) params.set('agent_status', filters.agent_status);

        const response = await api.get<AssetListResponse>(`/assets?${params.toString()}`);
        const rows = response.assets || response.data || [];

        setAssets(rows);
        setTotal(Number(response.total || rows.length || 0));
      } catch {
        setAssets([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch, filters]
  );

  const fetchMeta = useCallback(async () => {
    try {
      const [groupsResponse, statsResponse] = await Promise.all([
        api.get<AssetGroupsResponse>('/asset-groups'),
        api.get<RawStatsResponse>('/assets/stats')
      ]);

      setGroups(groupsResponse.groups || groupsResponse.data || []);
      setStats(normalizeStats(statsResponse));
    } catch {
      setGroups([]);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAssets();
    });
  }, [fetchAssets]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMeta();
    });
  }, [fetchMeta]);

  async function refreshAll(): Promise<void> {
    await Promise.all([fetchAssets(true), fetchMeta()]);
  }

  function openAddModal(): void {
    setModalMode('add');
    setEditingAssetId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEditModal(asset: Asset): void {
    setModalMode('edit');
    setEditingAssetId(asset.id);
    setForm(toEditForm(asset));
    setShowModal(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      const payload = buildPayload(form);

      if (modalMode === 'edit' && editingAssetId) {
        await api.patch(`/assets/${editingAssetId}`, payload);
      } else {
        await api.post('/assets', payload);
      }

      setShowModal(false);
      setEditingAssetId(null);
      setForm({ ...EMPTY_FORM });
      await refreshAll();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, 'Unable to save asset.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAsset(assetId: string): Promise<void> {
    const asset = assets.find((item) => item.id === assetId);
    if (!window.confirm(`Delete ${asset?.name || 'this asset'}? This cannot be undone.`)) return;

    try {
      await api.delete(`/assets/${assetId}`);
      setMenuOpenId(null);
      setSelected((previous) => {
        const next = new Set(previous);
        next.delete(assetId);
        return next;
      });
      await refreshAll();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, 'Unable to delete asset.'));
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} asset(s)? This cannot be undone.`)) return;

    setDeleting(true);

    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/assets/${id}`)));
      setSelected(new Set());
      await refreshAll();
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, 'Unable to delete selected assets.'));
    } finally {
      setDeleting(false);
    }
  }

  function handleSearchChange(value: string): void {
    setPage(1);
    setSearch(value);
  }

  function handleFilterChange<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]): void {
    setPage(1);
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters(): void {
    setPage(1);
    setFilters({ asset_type: '', status: '', group_id: '', agent_status: '' });
  }

  function toggleSelect(id: string): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (selected.size === assets.length) {
      setSelected(new Set());
      return;
    }

    setSelected(new Set(assets.map((asset) => asset.id)));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const onlineCount = stats?.online || 0;
  const offlineCount = stats?.offline || 0;
  const needsAttentionCount = getNeedsAttentionCount(stats);

  const filterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box'
  };

  const controlButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)'
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--text)'
      }}
    >
      <div
        style={{
          padding: '24px 24px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 18,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Assets</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              Inventory, monitor, and manage every endpoint in one operational view.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {selected.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-border)',
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                <span>{selected.size} selected</span>
                {isAdmin && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={deleting}
                    style={{
                      ...controlButtonStyle,
                      padding: '8px 10px',
                      background: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      color: 'var(--text-inverse)',
                      boxShadow: 'none'
                    }}
                  >
                    <Trash2 size={14} />
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
                <button
                  onClick={() => setSelected(new Set())}
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--accent-border)',
                    background: 'var(--bg)',
                    color: 'var(--accent)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <button
              onClick={() => void refreshAll()}
              style={{ ...controlButtonStyle, background: 'var(--bg-elevated)' }}
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
              Resync
            </button>

            {canManage && (
              <button
                onClick={openAddModal}
                style={{
                  ...controlButtonStyle,
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  color: 'var(--text-inverse)'
                }}
              >
                <Plus size={15} />
                Add Asset
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard icon={Monitor} label="Total Assets" value={stats?.total || total} tone="var(--accent)" />
          <StatCard icon={Wifi} label="Online" value={onlineCount} tone="var(--success)" />
          <StatCard icon={WifiOff} label="Offline" value={offlineCount} tone="var(--text-muted)" />
          <StatCard icon={AlertTriangle} label="Needs Attention" value={needsAttentionCount} tone="var(--warning)" />
        </div>

        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-sm)',
            padding: 14
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: 280, flex: '1 1 320px' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search assets, hostname, IP, serial, model..."
                style={{ ...inputStyle, paddingLeft: 36 }}
              />
            </div>

            <div style={{ width: 170 }}>
              <SelectSearch
                options={Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label
                }))}
                value={filters.asset_type || null}
                onChange={(val) => handleFilterChange('asset_type', val || '')}
                placeholder="All Types"
                allowClear
              />
            </div>

            <div style={{ width: 170 }}>
              <SelectSearch
                options={['active', 'inactive', 'retired', 'maintenance', 'disposed'].map((status) => ({
                  value: status,
                  label: status.charAt(0).toUpperCase() + status.slice(1)
                }))}
                value={filters.status || null}
                onChange={(val) => handleFilterChange('status', val || '')}
                placeholder="All Statuses"
                allowClear
              />
            </div>

            <div style={{ width: 170 }}>
              <SelectSearch
                options={groups.map((group) => ({
                  value: group.id,
                  label: group.name
                }))}
                value={filters.group_id || null}
                onChange={(val) => handleFilterChange('group_id', val || '')}
                placeholder="All Groups"
                allowClear
              />
            </div>

            <button
              onClick={() => setShowFilters((previous) => !previous)}
              style={{
                ...controlButtonStyle,
                background: showFilters ? 'var(--accent-subtle)' : 'var(--bg)',
                color: showFilters ? 'var(--accent)' : 'var(--text)'
              }}
            >
              <Filter size={15} />
              Filters
              {filterCount > 0 ? (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    padding: '0 5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--accent)',
                    color: 'var(--text-inverse)',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {filterCount}
                </span>
              ) : null}
              <ChevronDown size={14} />
            </button>
          </div>

          {showFilters && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center'
              }}
            >
              <div style={{ width: 170 }}>
                <SelectSearch
                  options={[
                    { value: 'online', label: 'Online' },
                    { value: 'offline', label: 'Offline' },
                    { value: 'unknown', label: 'Unknown' }
                  ]}
                  value={filters.agent_status || null}
                  onChange={(val) => handleFilterChange('agent_status', val || '')}
                  placeholder="All Agent States"
                  allowClear
                />
              </div>

              {filterCount > 0 && (
                <button
                  onClick={clearFilters}
                  style={{ ...controlButtonStyle, color: 'var(--danger)' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: 24, overflow: 'auto' }}>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'visible',
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 14,
                padding: 48
              }}
            >
              Loading assets…
            </div>
          ) : assets.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: 48,
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)'
                }}
              >
                <Monitor size={34} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>No assets found</div>
              <div style={{ maxWidth: 420, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {filterCount > 0 || search
                  ? 'Try adjusting your search or filters to find matching assets.'
                  : 'Add your first asset or deploy the agent to start building a live inventory.'}
              </div>
              {canManage && !filterCount && !search ? (
                <button
                  onClick={openAddModal}
                  style={{
                    ...controlButtonStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    color: 'var(--text-inverse)'
                  }}
                >
                  <Plus size={15} />
                  Add Asset
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ width: 42, padding: '14px 12px' }}>
                        <input
                          type="checkbox"
                          checked={assets.length > 0 && selected.size === assets.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Asset</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Status</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Type</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Network</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>OS</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>CPU</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>RAM</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Group</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Owner</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Last seen</th>
                      <th style={{ width: 72, padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const TypeIcon = getTypeIcon(asset.asset_type);
                      const statusTone = getStatusTone(asset.status);
                      const cpuPercent = getCpuPercent(asset);
                      const ramPercent = getRamPercent(asset);
                      const isSelected = selected.has(asset.id);

                      return (
                        <tr
                          key={asset.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(event) => {
                            if (!isSelected) event.currentTarget.style.background = 'var(--bg-secondary)';
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = isSelected ? 'var(--accent-subtle)' : 'transparent';
                          }}
                          onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
                        >
                          <td style={{ padding: '14px 12px' }} onClick={(event) => event.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(asset.id)} />
                          </td>

                          <td style={{ padding: '14px 12px', minWidth: 240 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  marginTop: 5,
                                  flexShrink: 0,
                                  background: getAgentDotColor(asset.agent_status)
                                }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{asset.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                                  {asset.display_name || [asset.manufacturer, asset.model].filter(Boolean).join(' ') || getAgentLabel(asset)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px',
                                borderRadius: 999,
                                background: statusTone.background,
                                border: `1px solid ${statusTone.border}`,
                                color: statusTone.color,
                                fontSize: 12,
                                fontWeight: 700
                              }}
                            >
                              {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                            </span>
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px',
                                borderRadius: 999,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
                                fontSize: 12,
                                fontWeight: 700
                              }}
                            >
                              <TypeIcon size={13} />
                              {getTypeLabel(asset.asset_type)}
                            </span>
                          </td>

                          <td style={{ padding: '14px 12px', minWidth: 160 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{asset.ip_address || '—'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{asset.hostname || '—'}</div>
                          </td>

                          <td style={{ padding: '14px 12px', color: 'var(--text)', minWidth: 160 }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{asset.os_name || '—'}</div>
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <ProgressMini value={cpuPercent} tone="var(--warning)" />
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <ProgressMini value={ramPercent} tone="var(--accent)" />
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            {asset.group_name ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 10px',
                                  borderRadius: 999,
                                  background: asset.group_color
                                    ? `color-mix(in srgb, ${asset.group_color} 14%, var(--bg-secondary))`
                                    : 'var(--accent-subtle)',
                                  border: `1px solid ${asset.group_color || 'var(--accent-border)'}`,
                                  color: asset.group_color || 'var(--accent)',
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                {asset.group_name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: '14px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar name={asset.assigned_to_name} avatarUrl={asset.assigned_to_avatar} />
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.assigned_to_name || 'Unassigned'}</span>
                            </div>
                          </td>

                          <td style={{ padding: '14px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {timeAgo(asset.agent_last_seen)}
                          </td>

                          <td style={{ padding: '14px 12px' }} onClick={(event) => event.stopPropagation()}>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                const rect = event.currentTarget.getBoundingClientRect();
                                const rightEdge = window.innerWidth - rect.right;
                                setMenuPos({ top: rect.bottom + 6, right: Math.max(8, rightEdge) });
                                setMenuOpenId((current) => (current === asset.id ? null : asset.id));
                              }}
                              style={{
                                width: 34,
                                height: 34,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 18px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} assets
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    disabled={page === 1}
                    style={{
                      ...controlButtonStyle,
                      opacity: page === 1 ? 0.5 : 1,
                      cursor: page === 1 ? 'default' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>

                  <button
                    onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                    disabled={page === totalPages}
                    style={{
                      ...controlButtonStyle,
                      opacity: page === totalPages ? 0.5 : 1,
                      cursor: page === totalPages ? 'default' : 'pointer'
                    }}
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Portal-rendered action menu — outside overflow container so it's never clipped */}
      {menuOpenId && menuPos ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            minWidth: 170,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-md)',
            padding: 6,
            zIndex: 1100,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {(() => {
            const asset = assets.find((a) => a.id === menuOpenId);
            if (!asset) return null;
            return (
              <>
                <button
                  onClick={() => { setMenuOpenId(null); router.push(`/dashboard/assets/${asset.id}`); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                    fontSize: 13, textAlign: 'left'
                  }}
                >
                  <Eye size={14} />
                  View Details
                </button>

                {canManage ? (
                  <button
                    onClick={() => { setMenuOpenId(null); openEditModal(asset); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                      fontSize: 13, textAlign: 'left'
                    }}
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                ) : null}

                {canManage ? (
                  <button
                    onClick={() => { setMenuOpenId(null); router.push(`/dashboard/assets/${asset.id}`); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                      fontSize: 13, textAlign: 'left'
                    }}
                  >
                    <Radio size={14} />
                    Remote Desktop
                  </button>
                ) : null}

                {canManage ? (
                  <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                ) : null}

                {canManage ? (
                  <button
                    onClick={() => { setMenuOpenId(null); void handleDeleteAsset(asset.id); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'transparent', color: 'var(--danger)', cursor: 'pointer',
                      fontSize: 13, textAlign: 'left'
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : null}
              </>
            );
          })()}
        </div>,
        document.body
      ) : null}

      {showModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'color-mix(in srgb, var(--text) 26%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 1000
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              padding: 24
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
                  {modalMode === 'edit' ? 'Edit Asset' : 'Add Asset'}
                </h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Capture inventory details, ownership, network info, and lifecycle state.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Name" required>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="e.g. DESKTOP-ABC123"
                />
              </Field>

              <Field label="Type" required>
                <select
                  style={inputStyle}
                  value={form.asset_type}
                  onChange={(event) => setForm((previous) => ({ ...previous, asset_type: event.target.value }))}
                >
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status" required>
                <select
                  style={inputStyle}
                  value={form.status}
                  onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
                >
                  {['active', 'inactive', 'retired', 'maintenance', 'disposed'].map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Display Name">
                <input
                  style={inputStyle}
                  value={form.display_name}
                  onChange={(event) => setForm((previous) => ({ ...previous, display_name: event.target.value }))}
                  placeholder="Friendly name"
                />
              </Field>

              <Field label="Serial Number">
                <input
                  style={inputStyle}
                  value={form.serial_number}
                  onChange={(event) => setForm((previous) => ({ ...previous, serial_number: event.target.value }))}
                />
              </Field>

              <Field label="Manufacturer">
                <input
                  style={inputStyle}
                  value={form.manufacturer}
                  onChange={(event) => setForm((previous) => ({ ...previous, manufacturer: event.target.value }))}
                  placeholder="Dell, HP, Lenovo"
                />
              </Field>

              <Field label="Model">
                <input
                  style={inputStyle}
                  value={form.model}
                  onChange={(event) => setForm((previous) => ({ ...previous, model: event.target.value }))}
                />
              </Field>

              <Field label="IP Address">
                <input
                  style={inputStyle}
                  value={form.ip_address}
                  onChange={(event) => setForm((previous) => ({ ...previous, ip_address: event.target.value }))}
                  placeholder="192.168.1.100"
                />
              </Field>

              <Field label="OS">
                <input
                  style={inputStyle}
                  value={form.os_name}
                  onChange={(event) => setForm((previous) => ({ ...previous, os_name: event.target.value }))}
                  placeholder="Windows 11 Pro"
                />
              </Field>

              <Field label="Hostname">
                <input
                  style={inputStyle}
                  value={form.hostname}
                  onChange={(event) => setForm((previous) => ({ ...previous, hostname: event.target.value }))}
                />
              </Field>

              <Field label="Department">
                <input
                  style={inputStyle}
                  value={form.department}
                  onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))}
                />
              </Field>

              <Field label="Location">
                <input
                  style={inputStyle}
                  value={form.location}
                  onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
                />
              </Field>

              <Field label="Company">
                <input
                  style={inputStyle}
                  value={form.company}
                  onChange={(event) => setForm((previous) => ({ ...previous, company: event.target.value }))}
                />
              </Field>

              <Field label="Group">
                <select
                  style={inputStyle}
                  value={form.asset_group_id}
                  onChange={(event) => setForm((previous) => ({ ...previous, asset_group_id: event.target.value }))}
                >
                  <option value="">No Group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Vendor">
                <input
                  style={inputStyle}
                  value={form.vendor}
                  onChange={(event) => setForm((previous) => ({ ...previous, vendor: event.target.value }))}
                />
              </Field>

              <Field label="Purchase Date">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.purchase_date}
                  onChange={(event) => setForm((previous) => ({ ...previous, purchase_date: event.target.value }))}
                />
              </Field>

              <Field label="Warranty Expiry">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.warranty_expiry}
                  onChange={(event) => setForm((previous) => ({ ...previous, warranty_expiry: event.target.value }))}
                />
              </Field>

              <Field label="Purchase Cost">
                <input
                  type="number"
                  style={inputStyle}
                  value={form.purchase_cost}
                  onChange={(event) => setForm((previous) => ({ ...previous, purchase_cost: event.target.value }))}
                />
              </Field>

              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Notes">
                  <textarea
                    style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                    value={form.notes}
                    onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={controlButtonStyle}>
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !form.name.trim()}
                style={{
                  ...controlButtonStyle,
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  color: 'var(--text-inverse)',
                  opacity: saving || !form.name.trim() ? 0.7 : 1,
                  cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Saving…' : modalMode === 'edit' ? 'Save Changes' : 'Create Asset'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
