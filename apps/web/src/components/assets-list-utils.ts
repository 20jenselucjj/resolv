import {
  Asset, AssetFormState, ASSET_TYPE_ICONS, ASSET_TYPE_LABELS,
  RawStatsResponse, StatsData
} from '@/lib/assets-types';

export function timeAgo(date?: string): string {
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

export function getTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getTypeIcon(type: string): typeof import('lucide-react').Monitor {
  return ASSET_TYPE_ICONS[type] || ASSET_TYPE_ICONS.other;
}

export function normalizeStats(response: RawStatsResponse): StatsData {
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

export function getHardware(asset: Asset): Asset['hardware'] {
  if (asset.hardware) return asset.hardware;

  if (asset.cpu_model || asset.ram_total_gb) {
    return {
      ram_total_gb: asset.ram_total_gb
    };
  }

  return null;
}

export function getCpuPercent(asset: Asset): number | null {
  const value = getHardware(asset)?.cpu_usage_percent;
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.max(0, Math.min(100, Number(value)));
}

export function getRamPercent(asset: Asset): number | null {
  const hardware = getHardware(asset);
  if (!hardware || hardware.ram_total_gb == null || hardware.ram_used_gb == null || hardware.ram_total_gb <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, (Number(hardware.ram_used_gb) / Number(hardware.ram_total_gb)) * 100));
}

export function getNeedsAttentionCount(stats: StatsData | null): number {
  if (!stats) return 0;
  const maintenance = stats.by_status.find((item) => item.status === 'maintenance')?.count || 0;
  const inactive = stats.by_status.find((item) => item.status === 'inactive')?.count || 0;
  return maintenance + inactive;
}

export function getStatusTone(status: string): { background: string; color: string; border: string } {
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

export function getAgentDotColor(status: string): string {
  if (status === 'online') return 'var(--success)';
  if (status === 'offline') return 'var(--text-muted)';
  return 'var(--warning)';
}

export function getAgentLabel(asset: Asset): string {
  if (asset.agent_status === 'online') return 'Online';
  if (asset.agent_status === 'offline') {
    return asset.agent_last_seen ? `Offline • ${timeAgo(asset.agent_last_seen)}` : 'Offline';
  }
  return 'Unknown';
}

export function buildPayload(form: AssetFormState): Record<string, unknown> {
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

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function toEditForm(asset: Asset): AssetFormState {
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

// ── Column visibility persistence ──

const COLUMN_STORAGE_KEY = 'resolv_asset_columns';

export function loadVisibleColumns(defaultSet: Set<string>): Set<string> {
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch { /* ignore */ }
  return new Set(defaultSet);
}

export function saveVisibleColumns(columns: Set<string>): void {
  localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(Array.from(columns)));
}

export function formatCost(cost: number | null | undefined): string {
  if (cost == null) return '\u2014';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cost);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '\u2014';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
