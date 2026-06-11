'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Circle } from 'lucide-react';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomStatus {
  value: string;
  label: string;
  color: string;
}

/** Shape returned by GET /settings/portal (relevant fields only). */
export interface PortalSettingsResponse {
  status_label_open?: string;
  status_label_in_progress?: string;
  status_label_waiting?: string;
  status_label_resolved?: string;
  status_label_closed?: string;
  custom_statuses?: string | CustomStatus[];
  status_order?: string | string[];
  status_ticket_types?: string;
}

export interface StatusConfigContextValue {
  /** Options for dropdowns — includes 'all' first, ordered by status_order. */
  statusOptions: Array<{ value: string; label: string }>;
  /** Label + CSS badge class per status key (for badge rendering). */
  statusConfig: Record<string, { label: string; badgeClass: string }>;
  /** Label + hex colors + icon per status key (for portal-style rendering). */
  statusMap: Record<string, { label: string; color: string; bg: string; icon: any }>;
  /** Whether the initial fetch is still in-flight. */
  loading: boolean;
  /** The resolved status order array. */
  statusOrder: string[];
  /** Admin-configured ticket type filters per status. Missing/empty = show for all. */
  statusTicketTypes: Record<string, string[]>;
  /** Re-fetch status configuration from the server. */
  refreshStatusConfig: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_COLOR_MAP: Record<string, { color: string; bg: string }> = {
  default: { color: '#6b7280', bg: '#f3f4f6' },
  accent:  { color: '#3b82f6', bg: '#eff6ff' },
  success: { color: '#10b981', bg: '#d1fae5' },
  warning: { color: '#f59e0b', bg: '#fef3c7' },
  danger:  { color: '#ef4444', bg: '#fee2e2' },
};

const BADGE_CLASSES: Record<string, string> = {
  open:        'badge badge-open',
  in_progress: 'badge badge-progress',
  waiting:     'badge badge-waiting',
  resolved:    'badge badge-resolved',
  closed:      'badge badge-closed',
};

const DEFAULT_LABELS: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  waiting:     'Waiting',
  resolved:    'Resolved',
  closed:      'Closed',
};

const BUILTIN_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const;

const DEFAULT_STATUS_ORDER = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

// Built-in hex defaults when no admin overrides exist.
const BUILTIN_HEX: Record<string, { color: string; bg: string }> = {
  open:        { color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { color: '#f59e0b', bg: '#fef3c7' },
  waiting:     { color: '#6b7280', bg: '#f3f4f6' },
  resolved:    { color: '#10b981', bg: '#d1fae5' },
  closed:      { color: '#6b7280', bg: '#f3f4f6' },
};

// ---------------------------------------------------------------------------
// Default value (used while loading or when fetch fails)
// ---------------------------------------------------------------------------

function buildDefaultStatusOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'all', label: 'All' },
    ...DEFAULT_STATUS_ORDER.map((key) => ({ value: key, label: DEFAULT_LABELS[key] })),
  ];
}

function buildDefaultStatusConfig(): Record<string, { label: string; badgeClass: string }> {
  return Object.fromEntries(
    DEFAULT_STATUS_ORDER.map((key) => [
      key,
      { label: DEFAULT_LABELS[key], badgeClass: BADGE_CLASSES[key] },
    ]),
  );
}

function buildDefaultStatusMap(): Record<string, { label: string; color: string; bg: string; icon: any }> {
  return Object.fromEntries(
    DEFAULT_STATUS_ORDER.map((key) => [
      key,
      { label: DEFAULT_LABELS[key], ...BUILTIN_HEX[key], icon: Circle },
    ]),
  );
}

const DEFAULT_VALUE: StatusConfigContextValue = {
  statusOptions: buildDefaultStatusOptions(),
  statusConfig: buildDefaultStatusConfig(),
  statusMap: buildDefaultStatusMap(),
  loading: true,
  statusOrder: DEFAULT_STATUS_ORDER,
  statusTicketTypes: {},
  refreshStatusConfig: async () => {},
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const StatusConfigContext = createContext<StatusConfigContextValue>(DEFAULT_VALUE);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StatusConfigProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortalSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get<{ data: PortalSettingsResponse }>('/settings/portal');
      setData(res.data || {});
    } catch {
      // Silently fall back to defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchSettings().then(() => {
      if (cancelled) setLoading(true);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchSettings]);

  const value = useMemo<StatusConfigContextValue>(() => {
    if (!data || loading) {
      return {
        statusOptions: buildDefaultStatusOptions(),
        statusConfig: buildDefaultStatusConfig(),
        statusMap: buildDefaultStatusMap(),
        loading: true,
        statusOrder: DEFAULT_STATUS_ORDER,
        statusTicketTypes: {},
        refreshStatusConfig: fetchSettings,
      };
    }

    // ---- Parse status_order ----
    let statusOrder: string[];
    if (Array.isArray(data.status_order)) {
      statusOrder = data.status_order;
    } else if (typeof data.status_order === 'string') {
      try {
        statusOrder = JSON.parse(data.status_order);
      } catch {
        statusOrder = DEFAULT_STATUS_ORDER;
      }
    } else {
      statusOrder = DEFAULT_STATUS_ORDER;
    }

    // ---- Parse custom_statuses ----
    let customStatuses: CustomStatus[] = [];
    if (Array.isArray(data.custom_statuses)) {
      customStatuses = data.custom_statuses;
    } else if (typeof data.custom_statuses === 'string') {
      try {
        const parsed = JSON.parse(data.custom_statuses);
        customStatuses = Array.isArray(parsed) ? parsed : [];
      } catch {
        customStatuses = [];
      }
    }

    // ---- Custom labels from API ----
    const labelOverrides: Record<string, string> = {};
    if (data.status_label_open) labelOverrides.open = data.status_label_open;
    if (data.status_label_in_progress) labelOverrides.in_progress = data.status_label_in_progress;
    if (data.status_label_waiting) labelOverrides.waiting = data.status_label_waiting;
    if (data.status_label_resolved) labelOverrides.resolved = data.status_label_resolved;
    if (data.status_label_closed) labelOverrides.closed = data.status_label_closed;

    const getLabel = (key: string): string =>
      labelOverrides[key] || DEFAULT_LABELS[key] || key;

    // ---- statusOptions (dropdown) ----
    const statusOptions: Array<{ value: string; label: string }> = [
      { value: 'all', label: 'All' },
      ...statusOrder.map((key) => ({ value: key, label: getLabel(key) })),
    ];

    // ---- statusConfig (badge rendering) ----
    const statusConfig: Record<string, { label: string; badgeClass: string }> = {};
    for (const key of statusOrder) {
      const isBuiltin = BUILTIN_STATUSES.includes(key as (typeof BUILTIN_STATUSES)[number]);
      statusConfig[key] = {
        label: getLabel(key),
        badgeClass: isBuiltin ? BADGE_CLASSES[key] : 'badge badge-open',
      };
    }

    // ---- statusMap (portal-style rendering) ----
    const statusMap: Record<string, { label: string; color: string; bg: string; icon: any }> = {};
    for (const key of statusOrder) {
      const label = getLabel(key);

      if (BUILTIN_STATUSES.includes(key as (typeof BUILTIN_STATUSES)[number])) {
        // Built-in → use default hex values
        statusMap[key] = {
          label,
          ...BUILTIN_HEX[key],
          icon: Circle,
        };
      } else {
        // Custom status → look up color theme from ADMIN_COLOR_MAP
        const custom = customStatuses.find((c) => c.value === key);
        const theme = custom?.color || 'default';
        const hexColor = ADMIN_COLOR_MAP[theme];
        statusMap[key] = {
          label,
          color: hexColor.color,
          bg: hexColor.bg,
          icon: Circle,
        };
      }
    }

    // ---- Parse status_ticket_types ----
    let statusTicketTypes: Record<string, string[]> = {};
    if (typeof data.status_ticket_types === 'string') {
      try { statusTicketTypes = JSON.parse(data.status_ticket_types); } catch {}
    }

    return {
      statusOptions,
      statusConfig,
      statusMap,
      loading: false,
      statusOrder,
      statusTicketTypes,
      refreshStatusConfig: fetchSettings,
    };
  }, [data, loading]);

  return (
    <StatusConfigContext.Provider value={value}>
      {children}
    </StatusConfigContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStatusConfig(): StatusConfigContextValue {
  return useContext(StatusConfigContext);
}
