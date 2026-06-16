/**
 * Resolv shared constants — Single source of truth for colors, labels, and options
 * that are used across multiple pages. Import from here instead of redefining locally.
 */

// ─── Status Labels ────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PROBLEM_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  identified: 'Identified',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const CHANGE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  in_progress: 'In Progress',
  implemented: 'Implemented',
  closed: 'Closed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const MAJOR_INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: 'Active',
  investigating: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};

// ─── Status Colors (maps to CSS variables where possible) ─────

export const TICKET_STATUS_COLORS: Record<string, string> = {
  open: '#2563eb',
  in_progress: '#f59e0b',
  waiting: '#6b7280',
  resolved: '#059669',
  closed: '#6b7280',
};

export const PROBLEM_STATUS_COLORS: Record<string, string> = {
  open: '#2563eb',
  investigating: '#7c3aed',
  identified: '#f59e0b',
  resolved: '#059669',
  closed: '#6b7280',
};

export const CHANGE_STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  submitted: '#2563eb',
  approved: '#059669',
  in_progress: '#f59e0b',
  implemented: '#059669',
  closed: '#6b7280',
  cancelled: '#dc2626',
  rejected: '#dc2626',
};

export const MAJOR_INCIDENT_STATUS_COLORS: Record<string, string> = {
  open: '#dc2626',
  investigating: '#7c3aed',
  resolved: '#059669',
  closed: '#6b7280',
};

// ─── Priority Colors ──────────────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  low: '#4bce97',
  medium: '#f5cd47',
  high: '#f87168',
  critical: '#fd9891',
};

// ─── Ticket Type Colors ───────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
  incident: '#f87168',
  service_request: '#579dff',
  problem: '#f5cd47',
  change: '#a78bfa',
};

export const TYPE_LABELS: Record<string, string> = {
  incident: 'Incident',
  service_request: 'Service Request',
  problem: 'Problem',
  change: 'Change',
};

// ─── Option Arrays ────────────────────────────────────────────

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'incident', label: 'Incident' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'problem', label: 'Problem' },
  { value: 'change', label: 'Change' },
];

export const PROBLEM_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const CHANGE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];

export const CHANGE_PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const MAJOR_INCIDENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Active' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

// ─── Helpers ──────────────────────────────────────────────────

export function getStatusColor(status: string, map: Record<string, string>): string {
  return map[status] || '#6b7280';
}

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || '#6b7280';
}

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || '#6b7280';
}
