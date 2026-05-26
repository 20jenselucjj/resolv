'use client';

import { AlertTriangle, Package, Search, GitBranch } from 'lucide-react';

export const STATUS_OPTIONS = ['all', 'open', 'in_progress', 'waiting', 'closed'];
export const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];
export const TYPE_OPTIONS = ['all', 'incident', 'service_request', 'problem', 'change'];

export const DATE_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range...' },
];

export const priorityColors: Record<string, string> = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
  critical: 'var(--priority-critical)',
};

export const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  open:        { label: 'Open',        badgeClass: 'badge badge-open' },
  in_progress: { label: 'In Progress', badgeClass: 'badge badge-progress' },
  waiting:     { label: 'Waiting',     badgeClass: 'badge badge-waiting' },
  closed:      { label: 'Closed',      badgeClass: 'badge badge-resolved' },
  resolved:    { label: 'Closed',      badgeClass: 'badge badge-resolved' },
};

export const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  incident: { 
    label: 'Incident', 
    bg: 'var(--danger-bg)', 
    color: 'var(--danger)', 
    border: '1px solid var(--danger-border)' 
  },
  service_request: { 
    label: 'Service Request', 
    bg: 'var(--info-bg)', 
    color: 'var(--info)', 
    border: '1px solid var(--info-border)' 
  },
  problem: { 
    label: 'Problem', 
    bg: 'var(--warning-bg)', 
    color: 'var(--warning)', 
    border: '1px solid var(--warning-border)' 
  },
  change: { 
    label: 'Change', 
    bg: '#ede9fe', 
    color: '#7c3aed', 
    border: '1px solid #ddd6fe' 
  },
};

export const PRIORITY_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, waiting: 2, closed: 3 };

export const ALL_COLUMNS = [
  { id: 'number', label: '#', width: 60, minWidth: 40, sortable: true },
  { id: 'title', label: 'Title', width: undefined, minWidth: 100, sortable: true },
  { id: 'description', label: 'Description', width: 200, minWidth: 80, sortable: false },
  { id: 'ticket_type', label: 'Type', width: 110, minWidth: 80, sortable: true },
  { id: 'status', label: 'Status', width: 120, minWidth: 90, sortable: true },
  { id: 'priority', label: 'Priority', width: 110, minWidth: 80, sortable: true },
  { id: 'assignee', label: 'Assigned To', width: 140, minWidth: 100, sortable: true },
  { id: 'reporter', label: 'Reporter', width: 140, minWidth: 100, sortable: true },
  { id: 'due_date', label: 'Due Date', width: 110, minWidth: 80, sortable: true },
  { id: 'created_at', label: 'Created', width: 110, minWidth: 80, sortable: true },
  { id: 'updated_at', label: 'Updated', width: 110, minWidth: 80, sortable: true },
] as const;

export const VIEWS = ['All', 'My Tickets', 'Unassigned', 'SLA Breached', 'Due Today'];

export const TICKET_TYPE_OPTIONS_PANEL = [
  { value: 'incident',        label: 'Incident',        icon: AlertTriangle, color: 'var(--danger)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)' },
  { value: 'service_request', label: 'Service Request', icon: Package,       color: 'var(--info)',     bg: 'var(--info-bg)',     border: 'var(--info-border)' },
  { value: 'problem',         label: 'Problem',         icon: Search,        color: 'var(--warning)',  bg: 'var(--warning-bg)',  border: 'var(--warning-border)' },
  { value: 'change',          label: 'Change',          icon: GitBranch,     color: '#7c3aed',         bg: '#ede9fe',            border: '#ddd6fe' },
];

export const PRIORITY_OPTIONS_PANEL = [
  { value: 'low',      label: 'Low',      color: 'var(--priority-low)' },
  { value: 'medium',   label: 'Medium',   color: 'var(--priority-medium)' },
  { value: 'high',     label: 'High',     color: 'var(--priority-high)' },
  { value: 'critical', label: 'Critical', color: 'var(--priority-critical)' },
];