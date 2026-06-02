import * as React from 'react';
import {
  Monitor,
  Server,
  Laptop,
  Printer,
  Smartphone,
  Network,
  Package,
  Wifi,
  Users,
  Shield,
  Cpu,
  Activity
} from 'lucide-react';
import type { AssetHardware, NoticeTone } from '@/lib/asset-detail-types';
import { connectSocket } from '@/lib/socket';

export function useSocketConnection() {
  const socketRef = React.useRef<ReturnType<typeof connectSocket> | null>(null);
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    if (!socketRef.current && typeof window !== 'undefined') {
      socketRef.current = connectSocket();
      forceUpdate();
    }
  }, []);

  return socketRef.current;
}

export function useCompactLayout(breakpoint = 1120): boolean {
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const update = () => setCompact(window.innerWidth < breakpoint);
    update();
    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  }, [breakpoint]);

  return compact;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateTime(value?: string | null): string {
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

export function timeAgo(value?: string | null): string {
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

export function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatBytes(value?: number | null): string {
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

export function formatGb(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '—';

  return `${Number(value).toFixed(Number(value) >= 100 ? 0 : 1)} GB`;
}

export function clampPercent(value?: number | null): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

export function normalizeDns(value?: string[] | string | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function getAssetIcon(type?: string | null): React.ElementType {
  const normalized = type?.toLowerCase();

  if (normalized === 'server') return Server;
  if (normalized === 'laptop') return Laptop;
  if (normalized === 'printer') return Printer;
  if (normalized === 'mobile' || normalized === 'phone') return Smartphone;
  if (normalized === 'network_device' || normalized === 'network') return Network;

  return Monitor;
}

export function getActivityMeta(action: string): { icon: React.ElementType; tone: NoticeTone } {
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

export function toneColor(tone: NoticeTone): string {
  if (tone === 'success') return 'var(--success)';
  if (tone === 'warning') return 'var(--warning)';
  if (tone === 'danger') return 'var(--danger)';
  return 'var(--accent)';
}

export function getDiskSummary(hardware?: AssetHardware | null): {
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
