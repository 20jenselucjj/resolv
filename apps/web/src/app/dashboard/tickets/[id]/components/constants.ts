'use client';

import { Circle, Clock, Pause, CheckCircle, AlertTriangle, Package, Search, GitBranch } from 'lucide-react';

export const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open',        icon: Circle,       color: 'var(--info)' },
  { value: 'in_progress', label: 'In Progress',  icon: Clock,        color: 'var(--warning)' },
  { value: 'waiting',     label: 'Waiting',      icon: Pause,        color: 'var(--text-muted)' },
  { value: 'closed',      label: 'Closed',       icon: CheckCircle,  color: 'var(--success)' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: 'var(--priority-low)' },
  { value: 'medium',   label: 'Medium',   color: 'var(--priority-medium)' },
  { value: 'high',     label: 'High',     color: 'var(--priority-high)' },
  { value: 'critical', label: 'Critical', color: 'var(--priority-critical)' },
];

export const TICKET_TYPE_OPTIONS = [
  { value: 'incident',        label: 'Incident',        icon: AlertTriangle, color: 'var(--danger)' },
  { value: 'service_request', label: 'Service Request', icon: Package,       color: 'var(--info)' },
  { value: 'problem',         label: 'Problem',         icon: Search,        color: 'var(--warning)' },
  { value: 'change',          label: 'Change',          icon: GitBranch,     color: 'var(--purple)' },
];

export const CATEGORY_DOT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const statusBadgeClass: Record<string, string> = {
  open: 'badge badge-open',
  in_progress: 'badge badge-progress',
  waiting: 'badge badge-waiting',
  closed: 'badge badge-resolved',
  resolved: 'badge badge-resolved',
};