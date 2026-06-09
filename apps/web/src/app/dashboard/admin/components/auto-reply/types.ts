import type { CSSProperties } from 'react';

export interface AutoReplyCondition {
  ticket_types: string[];
  priorities: string[];
  category_id: string;
  keyword: string;
  statuses: string[];
}

export interface AutoReplyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AutoReplyCondition;
  reply_subject: string;
  reply_body: string;
  send_to_requester: boolean;
  send_to_assignee: boolean;
  template_id?: string;
  event?: string;
}

export interface FlatEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change'] as const;

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const;

export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting on User',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_COLORS: Record<string, string> = {
  open: '#2563eb',
  in_progress: '#7c3aed',
  waiting: '#f59e0b',
  resolved: '#059669',
  closed: '#6b7280',
};

export const EVENTS = [
  { value: 'any', label: 'Any Event' },
  { value: 'ticket_created', label: 'Ticket Created' },
  { value: 'ticket_assigned', label: 'Ticket Assigned' },
  { value: 'ticket_reassigned', label: 'Ticket Reassigned' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'comment_added', label: 'Comment Added' },
  { value: 'ticket_resolved', label: 'Ticket Resolved' },
  { value: 'ticket_closed', label: 'Ticket Closed' },
];

export const EVENT_LABELS: Record<string, string> = {
  any: 'Any Event',
  ticket_created: 'Ticket Created',
  ticket_assigned: 'Ticket Assigned',
  ticket_reassigned: 'Ticket Reassigned',
  status_changed: 'Status Changed',
  comment_added: 'Comment Added',
  ticket_resolved: 'Ticket Resolved',
  ticket_closed: 'Ticket Closed',
};

export const defaultFormData = {
  name: '',
  description: '',
  ticket_types: [] as string[],
  priorities: [] as string[],
  statuses: [] as string[],
  category_id: '',
  keyword: '',
  template_id: '',
  event: 'any',
  reply_subject: 'Re: Ticket #[TICKET_ID]',
  reply_body: '',
  send_to_requester: true,
  send_to_assignee: false,
};

export const VARIABLES_ALL = [
  'TICKET_ID', 'TICKET_TITLE', 'USER_NAME', 'AGENT_NAME', 'TICKET_URL',
  'PRIORITY', 'STATUS', 'REQUESTOR_NAME', 'ASSIGNED_TO_NAME',
  'CREATED_AT', 'DUE_DATE', 'CATEGORY', 'TICKET_TYPE', 'DESCRIPTION', 'COMMENT_BODY',
];

export const VARIABLES_SHORT = ['TICKET_ID', 'USER_NAME', 'PRIORITY'];

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

export const labelStyle: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
};
