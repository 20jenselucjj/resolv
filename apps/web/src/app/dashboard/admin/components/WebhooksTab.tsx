'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Webhook, Plus, Edit2, Trash2, Save, X, Play,
  RefreshCw, CheckCircle, XCircle, Clock, FileText,
  Eye, Copy, ChevronUp, ChevronDown, AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ToggleSwitch } from './ToggleSwitch';
// ─── Types ────────────────────────────────────────────────────────────────────

type WebhookEventType =
  | 'ticket.created' | 'ticket.updated' | 'ticket.status_changed' | 'ticket.assigned'
  | 'ticket.resolved' | 'ticket.closed' | 'comment.added' | 'sla.breached'
  | 'change.submitted' | 'change.approved' | 'change.completed'
  | 'problem.identified' | 'problem.resolved'
  | 'major_incident.declared' | 'major_incident.resolved';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status: 'success' | 'failed' | 'retrying';
  status_code?: number;
  response_body?: string;
  error_message?: string;
  attempt_count: number;
  duration_ms?: number;
  created_at: string;
}

interface WebhookFormData {
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
}

type ModalMode = 'create' | 'edit' | null;

interface DeliveryDetailModal {
  delivery: WebhookDelivery;
  webhookName: string;
}

// ─── Event Type Groups ────────────────────────────────────────────────────────

const EVENT_GROUPS: { label: string; events: { value: WebhookEventType; label: string; desc: string }[] }[] = [
  {
    label: 'Ticket Events',
    events: [
      { value: 'ticket.created', label: 'Ticket Created', desc: 'A new ticket is created in the system' },
      { value: 'ticket.updated', label: 'Ticket Updated', desc: 'Any update to a ticket (fields, status, etc.)' },
      { value: 'ticket.status_changed', label: 'Status Changed', desc: 'Ticket status transitions (e.g., open → in progress)' },
      { value: 'ticket.assigned', label: 'Ticket Assigned', desc: 'Ticket is assigned to an agent or group' },
      { value: 'ticket.resolved', label: 'Ticket Resolved', desc: 'Ticket is marked as resolved' },
      { value: 'ticket.closed', label: 'Ticket Closed', desc: 'Ticket is closed' },
      { value: 'comment.added', label: 'Comment Added', desc: 'A public or internal comment is added to a ticket' },
      { value: 'sla.breached', label: 'SLA Breached', desc: 'An SLA target has been breached on a ticket' },
    ],
  },
  {
    label: 'Change Events',
    events: [
      { value: 'change.submitted', label: 'Change Submitted', desc: 'A change request is submitted for review' },
      { value: 'change.approved', label: 'Change Approved', desc: 'A change request is approved' },
      { value: 'change.completed', label: 'Change Completed', desc: 'A change request implementation is completed' },
    ],
  },
  {
    label: 'Problem Events',
    events: [
      { value: 'problem.identified', label: 'Problem Identified', desc: 'A problem record is created' },
      { value: 'problem.resolved', label: 'Problem Resolved', desc: 'A problem record is resolved' },
    ],
  },
  {
    label: 'Major Incident Events',
    events: [
      { value: 'major_incident.declared', label: 'Major Incident Declared', desc: 'A major incident is declared' },
      { value: 'major_incident.resolved', label: 'Major Incident Resolved', desc: 'A major incident is resolved' },
    ],
  },
];

const ALL_EVENT_VALUES = EVENT_GROUPS.flatMap(g => g.events.map(e => e.value));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url;
  return url.substring(0, max - 3) + '...';
}

function getEventLabel(value: string): string {
  for (const group of EVENT_GROUPS) {
    const found = group.events.find(e => e.value === value);
    if (found) return found.label;
  }
  return value;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px',
};

const sectionDesc: React.CSSProperties = {
  fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: '60px', fontSize: '12px', lineHeight: 1.5, fontFamily: 'monospace',
  resize: 'vertical',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: '4px',
};

const fieldDescStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-muted)', margin: '-2px 0 8px',
};

const subsectionStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: '16px', marginTop: '12px',
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnDangerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', background: 'var(--danger)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnGhostStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnIconStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28,
  background: 'transparent', color: 'var(--text-muted)',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const badgeGreen: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--success-bg)', color: 'var(--success)',
  border: '1px solid var(--success-border)',
  textTransform: 'capitalize',
};

const badgeRed: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--danger-bg)', color: 'var(--danger)',
  border: '1px solid var(--danger-border)',
  textTransform: 'capitalize',
};

const badgeYellow: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--warning-bg)', color: 'var(--warning)',
  border: '1px solid var(--warning-border)',
  textTransform: 'capitalize',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.5)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(2px)',
};

const modalCardStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  width: '100%', maxWidth: 600,
  maxHeight: '90vh', display: 'flex', flexDirection: 'column',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px', borderBottom: '1px solid var(--border)',
};

const modalBodyStyle: React.CSSProperties = {
  padding: '20px', overflowY: 'auto', flex: 1,
};

const modalFooterStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  gap: 8, padding: '12px 20px',
  borderTop: '1px solid var(--border)',
};

// ─── Event Group Checkboxes Sub-component ─────────────────────────────────────

function EventGroupCheckboxes({
  group,
  selected,
  onChange,
}: {
  group: typeof EVENT_GROUPS[number];
  selected: WebhookEventType[];
  onChange: (events: WebhookEventType[]) => void;
}) {
  const groupValues = group.events.map(e => e.value);
  const allSelected = groupValues.every(v => selected.includes(v));
  const someSelected = groupValues.some(v => selected.includes(v));

  const toggleGroup = () => {
    if (allSelected) {
      onChange(selected.filter(v => !groupValues.includes(v)));
    } else {
      const existing = selected.filter(v => !groupValues.includes(v));
      onChange([...existing, ...groupValues]);
    }
  };

  const toggleEvent = (value: WebhookEventType) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div style={subsectionStyle}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, cursor: 'pointer', userSelect: 'none',
        }}
        onClick={toggleGroup}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          {group.label}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600, color: 'var(--accent)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          background: 'var(--accent-subtle)',
        }}>
          {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {group.events.map(ev => {
          const isChecked = selected.includes(ev.value);
          return (
            <label
              key={ev.value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                cursor: 'pointer', padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                background: isChecked ? 'var(--bg-elevated)' : 'transparent',
                transition: 'background 0.15s ease',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleEvent(ev.value)}
                style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'block' }}>
                  {ev.label}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {ev.desc}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Delivery Detail Panel ────────────────────────────────────────────────────

function DeliveryDetailPanel({ delivery, onClose, onRetry, retrying }: {
  delivery: WebhookDelivery;
  onClose: () => void;
  onRetry: (id: string) => void;
  retrying: boolean;
}) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...modalCardStyle, maxWidth: 720 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
              Delivery Detail
            </h3>
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              ...(delivery.status === 'success' ? badgeGreen : delivery.status === 'retrying' ? badgeYellow : badgeRed),
              textTransform: 'capitalize',
            }}>
              {delivery.status}
            </span>
          </div>
          <button onClick={onClose} style={btnIconStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={modalBodyStyle}>
          {/* Meta info */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Event</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{getEventLabel(delivery.event)}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Timestamp</span>
              <span style={{ fontSize: '13px', color: 'var(--text)' }}>{formatTimestamp(delivery.created_at)}</span>
            </div>
            {delivery.status_code != null && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>HTTP Status</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{delivery.status_code}</span>
              </div>
            )}
            {delivery.duration_ms != null && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Duration</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{formatDuration(delivery.duration_ms)}</span>
              </div>
            )}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Attempts</span>
              <span style={{ fontSize: '13px', color: 'var(--text)' }}>{delivery.attempt_count}</span>
            </div>
          </div>

          {/* Error message */}
          {delivery.error_message && (
            <div style={{
              padding: '12px', borderRadius: 'var(--radius-md)',
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              color: 'var(--danger)', fontSize: '12px', lineHeight: 1.5,
              marginBottom: 16, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <AlertCircle size={13} />
                <span style={{ fontWeight: 600 }}>Error</span>
              </div>
              {delivery.error_message}
            </div>
          )}

          {/* Request payload */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} />
              Request Payload
            </h4>
            <pre style={{
              ...inputStyle, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5,
              maxHeight: 240, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {JSON.stringify(delivery.payload, null, 2)}
            </pre>
          </div>

          {/* Response */}
          {delivery.response_body && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={12} />
                Response Body
              </h4>
              <pre style={{
                ...inputStyle, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5,
                maxHeight: 240, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {delivery.response_body.length > 5000 ? delivery.response_body.substring(0, 5000) + '\n\n... (truncated)' : delivery.response_body}
              </pre>
            </div>
          )}
        </div>

        {/* Footer with retry */}
        <div style={modalFooterStyle}>
          {(delivery.status === 'failed' || delivery.status === 'retrying') && (
            <button
              onClick={() => onRetry(delivery.id)}
              disabled={retrying}
              style={{
                ...btnPrimaryStyle,
                opacity: retrying ? 0.6 : 1,
                cursor: retrying ? 'default' : 'pointer',
              }}
            >
              {retrying ? (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <RefreshCw size={13} />
              )}
              {retrying ? 'Retrying...' : 'Retry Delivery'}
            </button>
          )}
          <button onClick={onClose} style={btnGhostStyle}>
            <X size={13} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Tooltip ────────────────────────────────────────────────────────────

function EventsPopover({ events }: { events: WebhookEventType[] }) {
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setTimeout(() => { if (!open) setHovering(false); }, 100)}
    >
      <span
        onClick={() => setOpen(!open)}
        style={{
          ...badgeGreen,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
          background: 'var(--accent-subtle)', color: 'var(--accent)',
          border: '1px solid var(--accent-border)',
        }}
      >
        <span>{events.length}</span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </span>
      {(open || hovering) && events.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            marginTop: 6, minWidth: 200,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: '8px 12px',
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => { setHovering(false); setOpen(false); }}
        >
          {events.map(ev => (
            <div key={ev} style={{ fontSize: '11px', color: 'var(--text)', padding: '2px 0', whiteSpace: 'nowrap' }}>
              {getEventLabel(ev)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WebhooksTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [retryingDelivery, setRetryingDelivery] = useState<string | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delivery log state
  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  // Delivery detail
  const [deliveryDetail, setDeliveryDetail] = useState<DeliveryDetailModal | null>(null);

  // Form data
  const [form, setForm] = useState<WebhookFormData>({
    name: '',
    url: '',
    secret: '',
    events: [],
    is_active: true,
    retry_count: 3,
    timeout_seconds: 30,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState(false);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Data Loading ───────────────────────────────────────────────────────────

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: WebhookConfig[] }>('/webhooks');
      setWebhooks(res.data || []);
    } catch {
      showAlert('Failed to load webhooks', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const loadDeliveries = useCallback(async (webhookId: string) => {
    setDeliveriesLoading(true);
    try {
      const res = await api.get<{ data: WebhookDelivery[] }>(`/webhooks/${webhookId}/deliveries`);
      setDeliveries(res.data || []);
      setDeliveryWebhookId(webhookId);
    } catch {
      showAlert('Failed to load delivery log', 'error');
    } finally {
      setDeliveriesLoading(false);
    }
  }, [showAlert]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setForm({ name: '', url: '', secret: '', events: [], is_active: true, retry_count: 3, timeout_seconds: 30 });
    setFormErrors({});
    setShowSecret(false);
    setEditingId(null);
    setModalMode('create');
  };

  const openEditModal = async (webhook: WebhookConfig) => {
    try {
      const res = await api.get<{ data: WebhookConfig }>(`/webhooks/${webhook.id}`);
      const w = res.data;
      setForm({
        name: w.name,
        url: w.url,
        secret: w.secret || '',
        events: w.events,
        is_active: w.is_active,
        retry_count: w.retry_count,
        timeout_seconds: w.timeout_seconds,
      });
      setFormErrors({});
      setShowSecret(false);
      setEditingId(w.id);
      setModalMode('edit');
    } catch {
      showAlert('Failed to load webhook details', 'error');
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.url.trim()) {
      errors.url = 'URL is required';
    } else {
      try {
        const url = new URL(form.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        errors.url = 'Enter a valid HTTP or HTTPS URL';
      }
    }
    if (form.events.length === 0) errors.events = 'Select at least one event';
    if (form.retry_count < 0 || form.retry_count > 10) errors.retry_count = 'Must be 0–10';
    if (form.timeout_seconds < 5 || form.timeout_seconds > 120) errors.timeout_seconds = 'Must be 5–120';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        secret: form.secret || undefined,
        events: form.events,
        is_active: form.is_active,
        retry_count: form.retry_count,
        timeout_seconds: form.timeout_seconds,
      };

      if (modalMode === 'create') {
        await api.post<{ data: WebhookConfig }>('/webhooks', payload);
        showAlert('Webhook created');
      } else if (modalMode === 'edit' && editingId) {
        await api.patch<{ data: WebhookConfig }>(`/webhooks/${editingId}`, payload);
        showAlert('Webhook updated');
      }

      closeModal();
      await loadWebhooks();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save webhook', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/webhooks/${id}`);
      showAlert('Webhook deleted');
      setDeleteConfirmId(null);
      // Close delivery log if showing this webhook
      if (deliveryWebhookId === id) {
        setDeliveryWebhookId(null);
        setDeliveries([]);
      }
      await loadWebhooks();
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete webhook', 'error');
    }
  };

  // ── Toggle Active ──────────────────────────────────────────────────────────

  const handleToggleActive = async (webhook: WebhookConfig) => {
    const newActive = !webhook.is_active;
    // Optimistic update
    setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, is_active: newActive } : w));
    try {
      await api.patch(`/webhooks/${webhook.id}`, { is_active: newActive });
      showAlert(newActive ? 'Webhook enabled' : 'Webhook disabled');
    } catch {
      setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, is_active: webhook.is_active } : w));
      showAlert('Failed to toggle webhook', 'error');
    }
  };

  // ── Test Webhook ───────────────────────────────────────────────────────────

  const handleTest = async (webhookId: string) => {
    setTestingId(webhookId);
    try {
      await api.post<{ data: WebhookDelivery }>(`/webhooks/${webhookId}/test`, {});
      showAlert('Test event sent successfully');
      // Open delivery log after test
      await loadDeliveries(webhookId);
    } catch (err: any) {
      showAlert(err.message || 'Test failed', 'error');
    } finally {
      setTestingId(null);
    }
  };

  // ── Retry Delivery ─────────────────────────────────────────────────────────

  const handleRetryDelivery = async (deliveryId: string) => {
    setRetryingDelivery(deliveryId);
    try {
      const res = await api.post<{ data: WebhookDelivery }>(`/webhooks/deliveries/${deliveryId}/retry`, {});
      showAlert('Delivery retry initiated');
      // Update the delivery in the list and detail panel
      if (deliveryDetail && deliveryDetail.delivery.id === deliveryId) {
        setDeliveryDetail({ ...deliveryDetail, delivery: res.data });
      }
      setDeliveries(prev => prev.map(d => d.id === deliveryId ? res.data : d));
      setDeliveryDetail(null);
    } catch (err: any) {
      showAlert(err.message || 'Retry failed', 'error');
    } finally {
      setRetryingDelivery(null);
    }
  };

  // ── Copy to clipboard ──────────────────────────────────────────────────────

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showAlert('Copied to clipboard'),
      () => showAlert('Failed to copy', 'error'),
    );
  };

  // ── Loading Skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  // ── Delete Confirmation ────────────────────────────────────────────────────

  const deleteConfirmWebhook = deleteConfirmId ? webhooks.find(w => w.id === deleteConfirmId) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── Header Section ──────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={sectionTitle}>Webhooks</h3>
            <p style={sectionDesc}>
              Configure outbound webhook integrations to notify external systems about events
              in Resolv. Webhooks can send real-time event data to your own endpoints for
              automation, monitoring, and third-party integrations.
            </p>
          </div>
          <button onClick={openCreateModal} style={btnPrimaryStyle}>
            <Plus size={14} />
            Add Webhook
          </button>
        </div>
      </div>

      {/* ─── Webhook List ────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        {webhooks.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 20px', gap: 12,
          }}>
            <Webhook size={32} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              No webhooks configured
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, textAlign: 'center', maxWidth: 400 }}>
              Create your first webhook to start receiving real-time event notifications
              from Resolv in your external systems.
            </p>
            <button onClick={openCreateModal} style={{ ...btnPrimaryStyle, marginTop: 8 }}>
              <Plus size={14} />
              Add Webhook
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontSize: '12px',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Name
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    URL
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Events
                  </th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Status
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Last Delivery
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map(wh => (
                  <tr
                    key={wh.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                        {wh.name}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{ color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace', cursor: 'default' }}
                          title={wh.url}
                        >
                          {truncateUrl(wh.url)}
                        </span>
                        <button
                          onClick={() => handleCopy(wh.url)}
                          style={{ ...btnIconStyle, width: 20, height: 20 }}
                          title="Copy URL"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <EventsPopover events={wh.events} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ToggleSwitch
                          enabled={wh.is_active}
                          onChange={() => handleToggleActive(wh)}
                          small
                        />
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {formatTimestamp(wh.updated_at)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            loadDeliveries(wh.id);
                          }}
                          style={{
                            ...btnIconStyle,
                            color: deliveryWebhookId === wh.id ? 'var(--accent)' : 'var(--text-muted)',
                            background: deliveryWebhookId === wh.id ? 'var(--accent-subtle)' : 'transparent',
                          }}
                          title="View Delivery Log"
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          onClick={() => handleTest(wh.id)}
                          disabled={testingId === wh.id}
                          style={{
                            ...btnIconStyle,
                            opacity: testingId === wh.id ? 0.5 : 1,
                            cursor: testingId === wh.id ? 'default' : 'pointer',
                          }}
                          title="Send Test Event"
                        >
                          {testingId === wh.id ? (
                            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Play size={13} />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(wh)}
                          style={btnIconStyle}
                          title="Edit Webhook"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(wh.id)}
                          style={btnIconStyle}
                          title="Delete Webhook"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Delivery Log Section ────────────────────────────────────────── */}
      {deliveryWebhookId && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ ...sectionTitle, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} />
                Delivery Log
              </h3>
              <p style={{ ...sectionDesc, margin: '4px 0 0' }}>
                Recent deliveries for{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {webhooks.find(w => w.id === deliveryWebhookId)?.name || 'this webhook'}
                </strong>
              </p>
            </div>
            <button
              onClick={() => { setDeliveryWebhookId(null); setDeliveries([]); }}
              style={btnGhostStyle}
            >
              <X size={13} />
              Close
            </button>
          </div>

          {deliveriesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '13px' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Loading deliveries...
              </div>
            </div>
          ) : deliveries.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '32px 20px', gap: 8,
            }}>
              <Clock size={24} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                No deliveries recorded yet
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Use the Play button to send a test event, or wait for events to trigger.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Timestamp
                    </th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Event
                    </th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Status
                    </th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      HTTP
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Duration
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr
                      key={d.id}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {formatTimestamp(d.created_at)}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 500 }}>
                        {getEventLabel(d.event)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          ...(d.status === 'success' ? badgeGreen : d.status === 'retrying' ? badgeYellow : badgeRed),
                        }}>
                          {d.status === 'success' && <CheckCircle size={11} />}
                          {d.status === 'failed' && <XCircle size={11} />}
                          {d.status === 'retrying' && (
                            <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          )}
                          {d.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '12px', color: d.status_code ? 'var(--text)' : 'var(--text-muted)' }}>
                        {d.status_code ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
                        {formatDuration(d.duration_ms)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setDeliveryDetail({
                              delivery: d,
                              webhookName: webhooks.find(w => w.id === deliveryWebhookId)?.name || 'Webhook',
                            })}
                            style={btnIconStyle}
                            title="View Details"
                          >
                            <Eye size={13} />
                          </button>
                          {(d.status === 'failed' || d.status === 'retrying') && (
                            <button
                              onClick={() => handleRetryDelivery(d.id)}
                              disabled={retryingDelivery === d.id}
                              style={{
                                ...btnIconStyle,
                                opacity: retryingDelivery === d.id ? 0.5 : 1,
                                cursor: retryingDelivery === d.id ? 'default' : 'pointer',
                              }}
                              title="Retry Delivery"
                            >
                              {retryingDelivery === d.id ? (
                                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <RefreshCw size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Create / Edit Modal ─────────────────────────────────────────── */}
      {modalMode && (
        <div style={overlayStyle} onClick={closeModal}>
          <div
            style={modalCardStyle}
            onClick={e => e.stopPropagation()}
          >
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Webhook size={16} />
                {modalMode === 'create' ? 'Create Webhook' : 'Edit Webhook'}
              </h3>
              <button onClick={closeModal} style={btnIconStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBodyStyle}>
              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    ...inputStyle,
                    borderColor: formErrors.name ? 'var(--danger)' : 'var(--border)',
                  }}
                  placeholder="e.g., Slack Notifications"
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* URL */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  URL <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <p style={fieldDescStyle}>The endpoint that will receive webhook POST requests.</p>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
                  style={{
                    ...inputStyle,
                    borderColor: formErrors.url ? 'var(--danger)' : 'var(--border)',
                  }}
                  placeholder="https://hooks.example.com/events"
                />
                {formErrors.url && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                    {formErrors.url}
                  </span>
                )}
              </div>

              {/* Secret */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Secret (optional)</label>
                <p style={fieldDescStyle}>
                  Used to sign webhook payloads with HMAC-SHA256 for verification on your end.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={form.secret}
                      onChange={e => setForm(prev => ({ ...prev, secret: e.target.value }))}
                      style={inputStyle}
                      placeholder={modalMode === 'edit' ? 'Leave blank to keep current secret' : 'Optional signing secret'}
                    />
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        padding: 2,
                      }}
                      title={showSecret ? 'Hide secret' : 'Show secret'}
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                  {form.secret && (
                    <button
                      onClick={() => handleCopy(form.secret)}
                      style={btnIconStyle}
                      title="Copy secret"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Events */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Events <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <p style={fieldDescStyle}>
                  Select the events that should trigger this webhook.
                </p>

                {/* Select All / Deselect All */}
                <div style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => {
                      if (form.events.length === ALL_EVENT_VALUES.length) {
                        setForm(prev => ({ ...prev, events: [] }));
                      } else {
                        setForm(prev => ({ ...prev, events: [...ALL_EVENT_VALUES] }));
                      }
                    }}
                    style={{
                      ...btnGhostStyle,
                      fontSize: '11px', padding: '4px 10px',
                      background: 'var(--accent-subtle)', color: 'var(--accent)',
                      border: '1px solid var(--accent-border)',
                    }}
                  >
                    {form.events.length === ALL_EVENT_VALUES.length ? 'Deselect All' : 'Select All Events'}
                    <span style={{ marginLeft: 6, fontSize: '10px', opacity: 0.7 }}>
                      ({form.events.length}/{ALL_EVENT_VALUES.length})
                    </span>
                  </button>
                </div>

                {EVENT_GROUPS.map(group => (
                  <EventGroupCheckboxes
                    key={group.label}
                    group={group}
                    selected={form.events}
                    onChange={events => setForm(prev => ({ ...prev, events }))}
                  />
                ))}

                {formErrors.events && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                    {formErrors.events}
                  </span>
                )}
              </div>

              {/* Active toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                marginBottom: 16,
              }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'block' }}>
                    Active
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    When disabled, no events will be sent to this endpoint.
                  </span>
                </div>
                <ToggleSwitch
                  enabled={form.is_active}
                  onChange={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                />
              </div>

              {/* Retry and Timeout row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Max Retries</label>
                  <p style={fieldDescStyle}>Number of retry attempts for failed deliveries (0–10).</p>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.retry_count}
                    onChange={e => setForm(prev => ({ ...prev, retry_count: parseInt(e.target.value) || 0 }))}
                    style={{
                      ...inputStyle,
                      borderColor: formErrors.retry_count ? 'var(--danger)' : 'var(--border)',
                    }}
                  />
                  {formErrors.retry_count && (
                    <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                      {formErrors.retry_count}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Timeout (seconds)</label>
                  <p style={fieldDescStyle}>Request timeout before marking as failed (5–120s).</p>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={form.timeout_seconds}
                    onChange={e => setForm(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 30 }))}
                    style={{
                      ...inputStyle,
                      borderColor: formErrors.timeout_seconds ? 'var(--danger)' : 'var(--border)',
                    }}
                  />
                  {formErrors.timeout_seconds && (
                    <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                      {formErrors.timeout_seconds}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button onClick={closeModal} style={btnGhostStyle}>
                <X size={13} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...btnPrimaryStyle,
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? (
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Save size={13} />
                )}
                {saving ? 'Saving...' : modalMode === 'create' ? 'Create Webhook' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      {deleteConfirmId && deleteConfirmWebhook && (
        <div style={overlayStyle} onClick={() => setDeleteConfirmId(null)}>
          <div
            style={{
              ...modalCardStyle, maxWidth: 400,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={modalBodyStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-bg)', color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                    Delete Webhook
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Are you sure you want to delete <strong>{deleteConfirmWebhook.name}</strong>?
                  </p>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                This will immediately stop all event deliveries to this endpoint and remove
                all delivery history. This action cannot be undone.
              </p>
            </div>
            <div style={modalFooterStyle}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={btnGhostStyle}
              >
                <X size={13} />
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={btnDangerStyle}
              >
                <Trash2 size={13} />
                Delete Webhook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delivery Detail Modal ───────────────────────────────────────── */}
      {deliveryDetail && (
        <DeliveryDetailPanel
          delivery={deliveryDetail.delivery}
          onClose={() => setDeliveryDetail(null)}
          onRetry={async (deliveryId) => {
            await handleRetryDelivery(deliveryId);
            setDeliveryDetail(null);
          }}
          retrying={retryingDelivery === deliveryDetail.delivery.id}
        />
      )}
    </div>
  );
}
