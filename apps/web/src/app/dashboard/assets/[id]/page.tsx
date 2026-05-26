'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  Circle,
  Clock3,
  Cpu,
  Database,
  DollarSign,
  Download,
  Edit3,
  FileText,
  Globe,
  HardDrive,
  Laptop,
  LoaderCircle,
  MapPin,
  MemoryStick,
  Monitor,
  Network,
  Package,
  Printer,
  RefreshCw,
  Save,
  Search,
  Server,
  Shield,
  Smartphone,
  Ticket,
  Trash2,
  User,
  Users,
  Wifi,
  X
} from 'lucide-react';

import { api, API_BASE } from '@/lib/api';
import { connectSocket, createSocket } from '@/lib/socket';
import { useStore } from '@/lib/store';

interface AssetDisk {
  name?: string | null;
  size?: number | null;
  type?: string | null;
  vendor?: string | null;
  mount?: string | null;
  serial_number?: string | null;
}

interface AssetDisplay {
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  resolution?: string | null;
  refresh_rate_hz?: number | null;
  is_primary?: boolean | null;
}

interface AssetHardware {
  cpu_model?: string | null;
  cpu_cores?: number | null;
  cpu_threads?: number | null;
  cpu_speed_mhz?: number | null;
  cpu_usage_percent?: number | null;
  ram_total_gb?: number | null;
  ram_used_gb?: number | null;
  ram_free_gb?: number | null;
  disk_total_gb?: number | null;
  disk_used_gb?: number | null;
  disk_free_gb?: number | null;
  gpu_model?: string | null;
  gpu_vram_gb?: number | null;
  motherboard_manufacturer?: string | null;
  bios_version?: string | null;
  bios_release_date?: string | null;
  disks?: AssetDisk[] | null;
  displays?: AssetDisplay[] | null;
}

interface AssetSoftware {
  id?: string;
  name: string;
  version?: string | null;
  publisher?: string | null;
  install_date?: string | null;
  size_mb?: number | null;
}

interface AssetNetworkAdapter {
  id?: string;
  adapter_name?: string | null;
  name?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  subnet?: string | null;
  subnet_mask?: string | null;
  gateway?: string | null;
  dns_servers?: string[] | string | null;
  adapter_type?: string | null;
  speed_mbps?: number | null;
  is_virtual?: boolean | null;
  is_active?: boolean | null;
}

interface AssetUser {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  domain?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  user_avatar?: string | null;
  session_type?: string | null;
  session_host?: string | null;
  is_current?: boolean | null;
  logged_in_at?: string | null;
}

interface AssetActivityEntry {
  id?: string;
  action: string;
  actor_name?: string | null;
  details?: string | null;
  created_at: string;
}

interface AssetDetail {
  id: string;
  name?: string | null;
  hostname?: string | null;
  display_name?: string | null;
  asset_type: string;
  agent_status: 'online' | 'offline' | string;
  agent_last_seen?: string | null;
  agent_version?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  domain?: string | null;
  group_name?: string | null;
  assigned_to_name?: string | null;
  owner_name?: string | null;
  department?: string | null;
  location?: string | null;
  company?: string | null;
  vendor?: string | null;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  purchase_cost?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  os_name?: string | null;
  os_version?: string | null;
  hardware?: AssetHardware | null;
  software?: AssetSoftware[] | null;
  network_adapters?: AssetNetworkAdapter[] | null;
  users?: AssetUser[] | null;
  logged_users?: AssetUser[] | null;
  activity?: AssetActivityEntry[] | null;
}

interface AssetResponse {
  data: AssetDetail;
}

type TabId = 'overview' | 'hardware' | 'software' | 'network' | 'activity';
type NoticeTone = 'success' | 'warning' | 'danger' | 'accent';

const DISPLAY_FONT = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
const BODY_FONT = 'Aptos, "Segoe UI", system-ui, sans-serif';

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: Monitor },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
  { id: 'software', label: 'Software', icon: Package },
  { id: 'network', label: 'Network', icon: Wifi },
  { id: 'activity', label: 'Activity', icon: Activity }
];

function useSocketConnection() {
  const socketRef = React.useRef<ReturnType<typeof connectSocket> | null>(null);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!socketRef.current && typeof window !== 'undefined') {
      socketRef.current = connectSocket();
      forceUpdate();
    }
  }, []);

  return socketRef.current;
}

function useCompactLayout(breakpoint = 1120): boolean {
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const update = () => setCompact(window.innerWidth < breakpoint);
    update();
    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  }, [breakpoint]);

  return compact;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function timeAgo(value?: string | null): string {
  if (!value) return 'Never';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';

  const diff = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function formatBytes(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '—';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Number(value);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : size >= 100 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function formatGb(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '—';

  return `${Number(value).toFixed(Number(value) >= 100 ? 0 : 1)} GB`;
}

function clampPercent(value?: number | null): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function normalizeDns(value?: string[] | string | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function getAssetIcon(type?: string | null): React.ElementType {
  const normalized = type?.toLowerCase();

  if (normalized === 'server') return Server;
  if (normalized === 'laptop') return Laptop;
  if (normalized === 'printer') return Printer;
  if (normalized === 'mobile' || normalized === 'phone') return Smartphone;
  if (normalized === 'network_device' || normalized === 'network') return Network;

  return Monitor;
}

function getActivityMeta(action: string): { icon: React.ElementType; tone: NoticeTone } {
  const value = action.toLowerCase();

  if (value.includes('software') || value.includes('install') || value.includes('package')) {
    return { icon: Package, tone: 'accent' };
  }

  if (value.includes('network') || value.includes('adapter') || value.includes('ip')) {
    return { icon: Wifi, tone: 'warning' };
  }

  if (value.includes('user') || value.includes('login') || value.includes('session')) {
    return { icon: Users, tone: 'success' };
  }

  if (value.includes('policy') || value.includes('security') || value.includes('compliance')) {
    return { icon: Shield, tone: 'danger' };
  }

  if (value.includes('hardware') || value.includes('bios') || value.includes('disk')) {
    return { icon: Cpu, tone: 'warning' };
  }

  return { icon: Activity, tone: 'accent' };
}

function toneColor(tone: NoticeTone): string {
  if (tone === 'success') return 'var(--success)';
  if (tone === 'warning') return 'var(--warning)';
  if (tone === 'danger') return 'var(--danger)';
  return 'var(--accent)';
}

function getDiskSummary(hardware?: AssetHardware | null): {
  total: number;
  used: number;
  free: number;
} {
  if (!hardware) {
    return { total: 0, used: 0, free: 0 };
  }

  if (hardware.disk_total_gb != null) {
    return {
      total: Number(hardware.disk_total_gb || 0),
      used: Number(hardware.disk_used_gb || 0),
      free: Number(hardware.disk_free_gb || 0)
    };
  }

  const disks = hardware.disks || [];

  return disks.reduce<{ total: number; used: number; free: number }>(
    (acc, disk) => {
      const size = disk.size ? Number(disk.size) / (1024 * 1024 * 1024) : 0;
      return {
        total: acc.total + size,
        used: acc.used,
        free: acc.free
      };
    },
    { total: 0, used: 0, free: 0 }
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  children
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      style={{
        background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {Icon && (
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
              <Icon size={16} color="var(--accent)" />
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.01em'
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>
            )}
          </div>
        </div>

        {actions}
      </div>

      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function DetailGrid({
  items,
  columns = 2
}: {
  items: Array<{ label: string; value?: React.ReactNode; accent?: boolean }>;
  columns?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 12
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px'
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: 6,
              fontWeight: 700
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: item.accent ? 'var(--accent)' : 'var(--text)',
              wordBreak: 'break-word'
            }}
          >
            {item.value ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({
  percent,
  color,
  label,
  meta
}: {
  percent: number;
  color: string;
  label: string;
  meta?: string;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meta || `${percent}%`}</div>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 999,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: color,
            transition: 'width 180ms ease'
          }}
        />
      </div>
    </div>
  );
}

function Pill({
  children,
  tone = 'accent'
}: {
  children: React.ReactNode;
  tone?: NoticeTone;
}): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: tone === 'accent' ? 'var(--accent-subtle)' : 'var(--bg)',
        color: toneColor(tone),
        fontSize: 12,
        fontWeight: 700
      }}
    >
      {children}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  children,
  tone = 'neutral',
  disabled,
  onClick
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  const background = tone === 'primary' ? 'var(--accent)' : tone === 'danger' ? 'var(--bg)' : 'var(--bg-elevated)';
  const color = tone === 'primary' ? 'var(--text-inverse)' : tone === 'danger' ? 'var(--danger)' : 'var(--text)';
  const border = tone === 'primary' ? 'var(--accent)' : tone === 'danger' ? 'var(--danger)' : 'var(--border)';

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 42,
        padding: '0 16px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: tone === 'primary' ? 'var(--shadow-md)' : 'none',
        transition: 'transform 140ms ease, opacity 140ms ease'
      }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '48px 24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--border)',
        background: 'var(--bg-secondary)',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}
      >
        <Icon size={22} color="var(--text-muted)" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>{description}</div>
    </div>
  );
}

function EditAssetModal({
  asset,
  onClose,
  onSaved
}: {
  asset: AssetDetail;
  onClose: () => void;
  onSaved: (next: AssetDetail) => void;
}): React.JSX.Element {
  const [form, setForm] = React.useState({
    display_name: asset.display_name || '',
    assigned_to_name: asset.assigned_to_name || '',
    department: asset.department || '',
    location: asset.location || '',
    company: asset.company || '',
    vendor: asset.vendor || '',
    purchase_date: asset.purchase_date || '',
    warranty_expiry: asset.warranty_expiry || ''
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 42,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    padding: '0 12px',
    fontSize: 13,
    fontFamily: BODY_FONT,
    boxSizing: 'border-box'
  };

  const save = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await api.patch<AssetResponse | undefined>(`/assets/${asset.id}`, form);
      onSaved(response?.data || { ...asset, ...form });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to save asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        padding: 24,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '18px 20px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Edit asset</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Update ownership, lifecycle, and display details.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['Display name', 'display_name', 'text'],
            ['Assigned to', 'assigned_to_name', 'text'],
            ['Department', 'department', 'text'],
            ['Location', 'location', 'text'],
            ['Company', 'company', 'text'],
            ['Vendor', 'vendor', 'text'],
            ['Purchase date', 'purchase_date', 'date'],
            ['Warranty expiry', 'warranty_expiry', 'date']
          ].map(([label, key, type]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  fontWeight: 700
                }}
              >
                {label}
              </span>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value
                  }))
                }
                style={inputStyle}
              />
            </label>
          ))}
        </div>

        {error && (
          <div style={{ padding: '0 20px 20px', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{error}</div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 20px 20px',
            borderTop: '1px solid var(--border)'
          }}
        >
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton icon={Save} tone="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export default function AssetDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = React.use(params);
  const router = useRouter();
  const socket = useSocketConnection();
  const compactLayout = useCompactLayout();
  const user = useStore((state) => state.user);

  const [asset, setAsset] = React.useState<AssetDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<TabId>('overview');
  const [softwareQuery, setSoftwareQuery] = React.useState('');
  const [software, setSoftware] = React.useState<AssetSoftware[]>([]);
  const [notes, setNotes] = React.useState('');
  const [savingNotes, setSavingNotes] = React.useState(false);

  const [deleting, setDeleting] = React.useState(false);
  const [resyncing, setResyncing] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: NoticeTone; text: string } | null>(null);
  const [showEditModal, setShowEditModal] = React.useState(false);

  const fetchAsset = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<AssetResponse>(`/assets/${id}`);
      setAsset(response.data);
      setNotes(response.data.notes || '');
    } catch (err: any) {
      setError(err.message || 'Unable to load asset');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchSoftware = React.useCallback(async () => {
    try {
      const response = await api.get<{ data: AssetSoftware[] }>(`/assets/${id}/software`);
      setSoftware(response.data || []);
    } catch {
      // software is non-critical
    }
  }, [id]);

  React.useEffect(() => {
    fetchAsset();
    fetchSoftware();
  }, [fetchAsset, fetchSoftware]);

  React.useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const users = asset?.users || asset?.logged_users || [];
  const activity = React.useMemo(() => {
    const entries = [...(asset?.activity || [])];

    return entries.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [asset?.activity]);

  const filteredSoftware = React.useMemo(() => {
    const source = software || [];
    const query = softwareQuery.trim().toLowerCase();

    if (!query) return source;

    return source.filter((app) => {
      const haystack = [app.name, app.version, app.publisher]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [software, softwareQuery]);

  const primaryName = asset?.name || asset?.hostname || 'Untitled asset';
  const secondaryName = asset?.display_name || [asset?.manufacturer, asset?.model].filter(Boolean).join(' ');
  const isOnline = asset?.agent_status === 'online';
  const lastSeen = asset?.agent_last_seen;
  const AssetIcon = getAssetIcon(asset?.asset_type);

  const hardware = asset?.hardware || null;
  const cpuPercent = clampPercent(hardware?.cpu_usage_percent);
  const memoryUsed = Number(hardware?.ram_used_gb || 0);
  const memoryTotal = Number(hardware?.ram_total_gb || 0);
  const memoryFree = hardware?.ram_free_gb != null
    ? Number(hardware.ram_free_gb)
    : Math.max(memoryTotal - memoryUsed, 0);
  const memoryPercent = memoryTotal > 0 ? clampPercent((memoryUsed / memoryTotal) * 100) : 0;
  const diskSummary = getDiskSummary(hardware);
  const diskPercent = diskSummary.total > 0 ? clampPercent((diskSummary.used / diskSummary.total) * 100) : 0;

  const updateAsset = (next: AssetDetail) => {
    setAsset(next);
    setNotes(next.notes || '');
  };

  const patchAsset = async (payload: Partial<AssetDetail>, successMessage: string) => {
    if (!asset) return;

    const response = await api.patch<AssetResponse | undefined>(`/assets/${asset.id}`, payload);
    const nextAsset = response?.data || { ...asset, ...payload };
    updateAsset(nextAsset);
    setNotice({ tone: 'success', text: successMessage });
  };

  const saveNotes = async () => {
    if (!asset) return;

    setSavingNotes(true);

    try {
      await patchAsset({ notes }, 'Notes saved');
    } catch (err: any) {
      setNotice({ tone: 'danger', text: err.message || 'Unable to save notes' });
    } finally {
      setSavingNotes(false);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'agent';

  const deleteAsset = async () => {
    if (!asset) return;

    const confirmed = window.confirm(`Delete ${primaryName}? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);

    try {
      await api.delete(`/assets/${asset.id}`);
      router.push('/dashboard/assets');
    } catch (err: any) {
      setDeleting(false);
      setNotice({ tone: 'danger', text: err.message || 'Unable to delete asset' });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: BODY_FONT
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700 }}>
          <LoaderCircle size={18} />
          Loading asset detail…
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: BODY_FONT
        }}
      >
        <div style={{ maxWidth: 560, width: '100%' }}>
          <EmptyState
            icon={Monitor}
            title="Asset not found"
            description={error || 'This asset could not be loaded or may have been removed.'}
          />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <ActionButton icon={ArrowLeft} onClick={() => router.push('/dashboard/assets')}>
              Back to assets
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  const layoutColumns = compactLayout ? '1fr' : 'minmax(0, 2fr) minmax(320px, 1fr)';
  const twoUp = compactLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: BODY_FONT
      }}
    >
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: compactLayout ? 16 : 24 }}>
        <div
          style={{
            background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            marginBottom: 24
          }}
        >
          <div style={{ padding: compactLayout ? 16 : 24, borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => router.push('/dashboard/assets')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0
              }}
            >
              <ArrowLeft size={15} />
              Assets
            </button>
          </div>

          <div
            style={{
              padding: compactLayout ? 16 : 24,
              display: 'flex',
              alignItems: compactLayout ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, minWidth: 0 }}>
              <div
                style={{
                  width: compactLayout ? 64 : 76,
                  height: compactLayout ? 64 : 76,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0
                }}
              >
                <AssetIcon size={compactLayout ? 26 : 30} color="var(--accent)" />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Pill tone={isOnline ? 'success' : 'warning'}>
                    <Circle size={8} fill={isOnline ? 'var(--success)' : 'var(--text-muted)'} color={isOnline ? 'var(--success)' : 'var(--text-muted)'} />
                    {isOnline ? 'Online' : 'Offline'}
                  </Pill>
                  <Pill>{asset.asset_type.replace(/_/g, ' ')}</Pill>
                  {asset.os_name && <Pill>{`${asset.os_name} ${asset.os_version || ''}`.trim()}</Pill>}
                </div>

                <h1
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: compactLayout ? 34 : 44,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                    color: 'var(--text)',
                    margin: '0 0 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14
                  }}
                >
                  {primaryName}
                  <button
                    onClick={async () => {
                      if (resyncing) return;
                      setResyncing(true);
                      try {
                        if (isOnline && socket) {
                          socket.emit('agent:request-checkin', { assetId: id });
                          setNotice({ tone: 'success', text: 'Agent notified — refreshing data…' });
                          // Give agent time to check in and DB to update
                          await new Promise((r) => setTimeout(r, 3000));
                        } else {
                          setNotice({ tone: 'warning', text: 'Agent is offline — can only reload cached data' });
                        }
                        await Promise.all([fetchAsset(), fetchSoftware()]);
                        if (isOnline && socket) {
                          setNotice({ tone: 'success', text: 'Asset data refreshed' });
                        }
                      } finally {
                        setResyncing(false);
                      }
                    }}
                    title="Refresh asset data"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 8,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s, background 0.15s',
                      fontSize: 20,
                      opacity: resyncing ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                  >
                    <RefreshCw size={22} style={{ animation: resyncing ? 'spin 1s linear infinite' : undefined }} />
                  </button>
                </h1>

                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 14 }}>
                  {secondaryName || 'No display name provided'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    <Clock3 size={14} />
                    Last seen {timeAgo(lastSeen)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    <Globe size={14} />
                    {asset.hostname || asset.ip_address || 'No hostname'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {canManage && <ActionButton icon={Edit3} onClick={() => setShowEditModal(true)}>Edit</ActionButton>}
              {canManage && (
                <ActionButton icon={Trash2} tone="danger" disabled={deleting} onClick={deleteAsset}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </ActionButton>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: toneColor(notice.tone),
              fontSize: 13,
              fontWeight: 700,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {notice.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: layoutColumns, gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                padding: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {TABS.map(({ id: tabId, label, icon: Icon }) => {
                const active = activeTab === tabId;

                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: active ? '1px solid var(--accent)' : '1px solid transparent',
                      background: active ? 'var(--accent-subtle)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 140ms ease'
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                <Panel title="Asset identity" subtitle="Core serial and platform details" icon={Monitor}>
                  <DetailGrid
                    items={[
                      { label: 'Type', value: asset.asset_type.replace(/_/g, ' ') },
                      { label: 'Serial number', value: asset.serial_number },
                      { label: 'Manufacturer', value: asset.manufacturer },
                      { label: 'Model', value: asset.model },
                      { label: 'OS', value: `${asset.os_name || ''} ${asset.os_version || ''}`.trim() || '—' },
                      { label: 'Primary name', value: primaryName, accent: true }
                    ]}
                  />
                </Panel>

                <Panel title="Network info" subtitle="Primary network identifiers" icon={Globe}>
                  <DetailGrid
                    items={[
                      { label: 'IP address', value: asset.ip_address },
                      { label: 'Hostname', value: asset.hostname },
                      { label: 'MAC', value: asset.mac_address },
                      { label: 'Domain', value: asset.domain }
                    ]}
                  />
                </Panel>

                <Panel title="Organization" subtitle="Ownership and organizational context" icon={Building2}>
                  <DetailGrid
                    items={[
                      {
                        label: 'Group',
                        value: asset.group_name ? <Pill>{asset.group_name}</Pill> : '—'
                      },
                      { label: 'Assigned to', value: users[0]?.display_name || users[0]?.username || asset.assigned_to_name || asset.owner_name },
                      { label: 'Department', value: asset.department },
                      { label: 'Location', value: asset.location },
                      { label: 'Company', value: asset.company }
                    ]}
                  />
                </Panel>

                <Panel title="Lifecycle" subtitle="Procurement and warranty history" icon={Calendar}>
                  <DetailGrid
                    items={[
                      { label: 'Purchase date', value: formatDate(asset.purchase_date) },
                      { label: 'Warranty expiry', value: formatDate(asset.warranty_expiry) },
                      { label: 'Purchase cost', value: formatCurrency(asset.purchase_cost) },
                      { label: 'Vendor', value: asset.vendor }
                    ]}
                  />
                </Panel>
              </div>
            )}

            {activeTab === 'hardware' && (
              hardware ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                    <Panel title="CPU" subtitle="Processor profile and live usage" icon={Cpu}>
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                          {hardware.cpu_model || '—'}
                        </div>
                        <DetailGrid
                          columns={2}
                          items={[
                            { label: 'Cores', value: hardware.cpu_cores },
                            { label: 'Threads', value: hardware.cpu_threads },
                            {
                              label: 'Speed',
                              value: hardware.cpu_speed_mhz != null
                                ? `${(Number(hardware.cpu_speed_mhz) / 1000).toFixed(2)} GHz`
                                : '—'
                            },
                            { label: 'Usage', value: `${cpuPercent.toFixed(1)}%` }
                          ]}
                        />
                      </div>
                      <ProgressBar percent={cpuPercent} color="var(--accent)" label="CPU usage" />
                    </Panel>

                    <Panel title="Memory" subtitle="Installed and available RAM" icon={MemoryStick}>
                      <div style={{ marginBottom: 18 }}>
                        <DetailGrid
                          columns={3}
                          items={[
                            { label: 'Total', value: formatGb(memoryTotal) },
                            { label: 'Used', value: formatGb(memoryUsed) },
                            { label: 'Free', value: formatGb(memoryFree) }
                          ]}
                        />
                      </div>
                      <ProgressBar
                        percent={memoryPercent}
                        color="var(--success)"
                        label="RAM usage"
                        meta={`${memoryPercent.toFixed(1)}%`}
                      />
                    </Panel>
                  </div>

                  <Panel title="Disk" subtitle="Capacity across all attached storage" icon={HardDrive}>
                    <div style={{ marginBottom: 18 }}>
                      <DetailGrid
                        columns={3}
                        items={[
                          { label: 'Total', value: formatGb(diskSummary.total) },
                          { label: 'Used', value: formatGb(diskSummary.used) },
                          { label: 'Free', value: formatGb(diskSummary.free) }
                        ]}
                      />
                    </div>
                    <ProgressBar percent={diskPercent} color="var(--warning)" label="Disk usage" meta={`${diskPercent.toFixed(1)}%`} />
                  </Panel>

                  <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                    <Panel title="GPU" subtitle="Graphics hardware" icon={Monitor}>
                      <DetailGrid
                        items={[
                          { label: 'Model', value: hardware.gpu_model },
                          { label: 'VRAM', value: formatGb(hardware.gpu_vram_gb) }
                        ]}
                      />
                    </Panel>

                    <Panel title="Motherboard & BIOS" subtitle="Platform firmware details" icon={Database}>
                      <DetailGrid
                        items={[
                          { label: 'Motherboard', value: hardware.motherboard_manufacturer },
                          { label: 'BIOS version', value: hardware.bios_version },
                          { label: 'BIOS date', value: formatDate(hardware.bios_release_date) }
                        ]}
                      />
                    </Panel>
                  </div>

                  <Panel title="Disks" subtitle={`${(hardware.disks || []).length} physical or logical volumes`} icon={HardDrive}>
                    {(hardware.disks || []).length === 0 ? (
                      <EmptyState icon={HardDrive} title="No disks reported" description="The agent has not returned detailed disk metadata yet." />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                         {(hardware.disks || []).map((disk, index) => {
                          const total = disk.size ? Number(disk.size) / (1024 * 1024 * 1024) : 0;
                          const used = diskSummary.total > 0 ? (diskSummary.used / diskSummary.total) * total : 0;
                          const free = total > 0 ? total - used : 0;
                          const percent = total > 0 ? clampPercent((used / total) * 100) : 0;

                          return (
                            <div
                              key={`${disk.name || 'disk'}-${index}`}
                              style={{
                                padding: 16,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg)'
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 16,
                                  marginBottom: 12,
                                  flexWrap: 'wrap'
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                                    {disk.name || `Disk ${index + 1}`}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {[disk.type, disk.mount, disk.serial_number].filter(Boolean).join(' • ') || 'Storage device'}
                                  </div>
                                </div>
                                <Pill tone="warning">{percent.toFixed(1)}% used</Pill>
                              </div>
                              <ProgressBar percent={percent} color="var(--warning)" label="Capacity" meta={`${formatGb(used)} of ${formatGb(total)}`} />
                              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                                Free space: {formatGb(free)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                    {(hardware.displays || []).length > 0 && (
                    <Panel title="Displays" subtitle={`${(hardware.displays || []).length} connected display panels`} icon={Monitor}>
                      {(hardware.displays || []).map((display, index) => (
                          <div
                            key={`${display.name || 'display'}-${index}`}
                            style={{
                              padding: 16,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                                  {display.name || `Display ${index + 1}`}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                  {[display.manufacturer, display.model].filter(Boolean).join(' • ') || 'Monitor'}
                                </div>
                              </div>
                              {display.is_primary && <Pill tone="success">Primary</Pill>}
                            </div>
                            <DetailGrid
                              columns={2}
                              items={[
                                { label: 'Resolution', value: display.resolution },
                                {
                                  label: 'Refresh rate',
                                  value: display.refresh_rate_hz != null ? `${display.refresh_rate_hz} Hz` : '—'
                                }
                              ]}
                            />
                          </div>
                        ))}
                    </Panel>
                    )}
                </div>
              ) : (
                <EmptyState
                  icon={Cpu}
                  title="No hardware telemetry"
                  description="Hardware details will appear here when the asset agent next reports inventory data."
                />
              )
            )}

            {activeTab === 'software' && (
              <Panel
                title="Installed software"
                subtitle={`${filteredSoftware.length} applications shown${softwareQuery ? ` • filtered from ${software.length}` : ''}`}
                icon={Package}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 240 }}>
                      <Search
                        size={15}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                      />
                      <input
                        value={softwareQuery}
                        onChange={(event) => setSoftwareQuery(event.target.value)}
                        placeholder="Search installed software"
                        style={{
                          width: '100%',
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          caretColor: 'var(--text)',
                          padding: '0 14px 0 38px',
                          fontSize: 13,
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    <Pill>{software.length} applications installed</Pill>
                  </div>

                  {software.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="No software inventory"
                      description="Installed applications will appear after the next inventory sync."
                    />
                  ) : filteredSoftware.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="No matches"
                      description="Try a different software name, publisher, or version search."
                    />
                  ) : (
                    <div
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        background: 'var(--bg)'
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(200px, 2fr) minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(100px, 0.8fr)',
                          gap: 0,
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--bg-secondary)',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--text-muted)',
                          fontWeight: 700
                        }}
                      >
                        <div>Name</div>
                        <div>Version</div>
                        <div>Publisher</div>
                        <div>Install date</div>
                        <div>Size</div>
                      </div>

                      {filteredSoftware.map((software, index) => (
                        <div
                          key={software.id || `${software.name}-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(200px, 2fr) minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(100px, 0.8fr)',
                            padding: '14px 16px',
                            borderBottom: index === filteredSoftware.length - 1 ? 'none' : '1px solid var(--border)',
                            fontSize: 13,
                            alignItems: 'center',
                            color: 'var(--text)'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{software.name}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{software.version || '—'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{software.publisher || '—'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{formatDate(software.install_date)}</div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {software.size_mb != null ? `${Number(software.size_mb).toFixed(1)} MB` : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {activeTab === 'network' && (
              (asset.network_adapters || []).length === 0 ? (
                <EmptyState
                  icon={Wifi}
                  title="No adapters reported"
                  description="Network adapter inventory will appear here when the endpoint reports connectivity details."
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                  {(asset.network_adapters || []).map((adapter, index) => {
                    const dns = normalizeDns(adapter.dns_servers);

                    return (
                      <Panel
                        key={adapter.id || `${adapter.adapter_name || adapter.name || 'adapter'}-${index}`}
                        title={adapter.adapter_name || adapter.name || `Adapter ${index + 1}`}
                        subtitle={[adapter.adapter_type, adapter.speed_mbps ? `${adapter.speed_mbps} Mbps` : null].filter(Boolean).join(' • ') || 'Network adapter'}
                        icon={Wifi}
                        actions={
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {adapter.is_active && <Pill tone="success">Active</Pill>}
                            {adapter.is_virtual && <Pill tone="warning">Virtual</Pill>}
                          </div>
                        }
                      >
                        <DetailGrid
                          items={[
                            { label: 'IP', value: adapter.ip_address },
                            { label: 'MAC', value: adapter.mac_address },
                            { label: 'Subnet', value: adapter.subnet || adapter.subnet_mask },
                            { label: 'Gateway', value: adapter.gateway },
                            { label: 'DNS', value: dns.length > 0 ? dns.join(', ') : '—' },
                            { label: 'Type', value: adapter.adapter_type }
                          ]}
                        />
                      </Panel>
                    );
                  })}
                </div>
              )
            )}

            {activeTab === 'activity' && (
              activity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No recent activity"
                  description="Activity will populate as changes, syncs, and remote actions occur on this asset."
                />
              ) : (
                <Panel title="Activity log" subtitle="Reverse-chronological system and operator events" icon={Activity}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {activity.map((entry, index) => {
                      const meta = getActivityMeta(entry.action);
                      const Icon = meta.icon;

                      return (
                        <div
                          key={entry.id || `${entry.action}-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '44px minmax(0, 1fr)',
                            gap: 14,
                            paddingBottom: index === activity.length - 1 ? 0 : 18,
                            marginBottom: index === activity.length - 1 ? 0 : 18,
                            borderBottom: index === activity.length - 1 ? 'none' : '1px solid var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Icon size={16} color={toneColor(meta.tone)} />
                            </div>
                          </div>

                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 16,
                                flexWrap: 'wrap',
                                marginBottom: 6
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{entry.action}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                  {entry.actor_name || 'System'}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                                {formatDateTime(entry.created_at)}
                              </div>
                            </div>
                            {entry.details && (
                              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{entry.details}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )
            )}
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, position: compactLayout ? 'static' : 'sticky', top: 24 }}>
            <Panel title="Agent status" subtitle="Realtime endpoint health" icon={Shield}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                      <Circle size={10} fill={isOnline ? 'var(--success)' : 'var(--text-muted)'} color={isOnline ? 'var(--success)' : 'var(--text-muted)'} />
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {isOnline ? <Pill tone="success">Agent active</Pill> : <Pill tone="warning">Awaiting heartbeat</Pill>}
                </div>

                <DetailGrid
                  items={[
                    { label: 'Last seen', value: formatDateTime(lastSeen) },
                    { label: 'Agent version', value: asset.agent_version },
                    { label: 'Remote access', value: isOnline ? 'Available' : 'Unavailable' }
                  ]}
                />
              </div>
            </Panel>

            <Panel title="Logged-in users" subtitle="Current sessions on this endpoint" icon={Users}>
              {users.length === 0 ? (
                <EmptyState icon={User} title="No active user data" description="No logged-in users were returned for this asset." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {users.map((session, index) => (
                    <div
                      key={session.id || `${session.username || 'user'}-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)'
                      }}
                    >
                      {session.user_avatar ? (
                        <img
                          src={session.user_avatar}
                          alt=""
                          style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-md)',
                            objectFit: 'cover', flexShrink: 0,
                            border: '1px solid var(--border)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-md)',
                            background: session.user_id ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >
                          <User size={16} color={session.user_id ? 'var(--accent)' : 'var(--text-muted)'} />
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {session.display_name || session.username || 'Unknown user'}
                          </div>
                          {session.is_current && <Pill tone="success">Current</Pill>}
                        </div>
                        {session.user_email && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            {session.user_email}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {[session.domain, session.username].filter(Boolean).join('\\') || 'No domain available'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Signed in {timeAgo(session.logged_in_at)}
                          </span>
                          {session.session_type && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px',
                              borderRadius: 999, border: '1px solid var(--border)',
                              background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                            }}>
                              {session.session_type === 'console' ? 'Local' : session.session_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Notes"
              subtitle="Internal context for operators"
              icon={FileText}
              actions={
                <ActionButton icon={Save} disabled={savingNotes} onClick={saveNotes}>
                  {savingNotes ? 'Saving…' : 'Save'}
                </ActionButton>
              }
            >
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Document useful context, known issues, or field notes…"
                rows={8}
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  padding: 14,
                  fontSize: 13,
                  fontFamily: BODY_FONT,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </Panel>

            <Panel title="Quick links" subtitle="Jump into adjacent workflows" icon={Ticket}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => router.push(`/dashboard/tickets?asset_id=${asset.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <Ticket size={15} color="var(--accent)" />
                    Open Tickets for this Asset
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                </button>

                <button
                  onClick={() => {
                    window.open(
                      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/assets/${asset.id}/logs`,
                      '_blank'
                    );
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <Download size={15} color="var(--accent)" />
                    Download Agent Logs
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                </button>
              </div>
            </Panel>

            <Panel title="Snapshot" subtitle="Fast operational readout" icon={Clock3}>
              <DetailGrid
                items={[
                  { label: 'Users', value: users.length },
                  { label: 'Adapters', value: (asset.network_adapters || []).length },
                  { label: 'Apps', value: software.length },
                  { label: 'Recent activity', value: activity.length },
                  { label: 'Purchase cost', value: formatCurrency(asset.purchase_cost) },
                  { label: 'Warranty', value: formatDate(asset.warranty_expiry) }
                ]}
              />
            </Panel>
          </aside>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {showEditModal && (
        <EditAssetModal asset={asset} onClose={() => setShowEditModal(false)} onSaved={updateAsset} />
      )}
    </div>
  );
}
