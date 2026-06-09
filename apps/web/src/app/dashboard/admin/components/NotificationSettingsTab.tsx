'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Save, Mail, BellRing, Info, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotificationChannel {
  email: boolean;
  in_app: boolean;
}

interface NotificationSettings {
  [event: string]: NotificationChannel;
}

const TICKET_EVENTS = [
  'ticket_created',
  'ticket_assigned',
  'ticket_updated',
  'ticket_resolved',
  'sla_breach',
  'comment_added',
] as const;

const ITSM_EVENTS = [
  'problem_created',
  'change_submitted',
  'change_approved',
  'change_rejected',
  'approval_created',
  'approval_escalated',
  'license_expiring',
] as const;

const CHANNELS = ['email', 'in_app'] as const;

const EVENT_LABELS: Record<string, string> = {
  ticket_created: 'Ticket Created',
  ticket_assigned: 'Ticket Assigned',
  ticket_updated: 'Ticket Updated',
  ticket_resolved: 'Ticket Resolved',
  sla_breach: 'SLA Breach',
  comment_added: 'Comment Added',
  problem_created: 'Problem Created',
  change_submitted: 'Change Submitted',
  change_approved: 'Change Approved',
  change_rejected: 'Change Rejected',
  approval_created: 'Approval Created',
  approval_escalated: 'Approval Escalated',
  license_expiring: 'License Expiring',
};

const DEFAULT_SETTINGS: NotificationSettings = {
  ticket_created: { email: true, in_app: true },
  ticket_assigned: { email: true, in_app: true },
  ticket_updated: { email: false, in_app: true },
  ticket_resolved: { email: true, in_app: true },
  sla_breach: { email: true, in_app: true },
  comment_added: { email: false, in_app: true },
  problem_created: { email: true, in_app: true },
  change_submitted: { email: true, in_app: true },
  change_approved: { email: true, in_app: true },
  change_rejected: { email: true, in_app: true },
  approval_created: { email: true, in_app: true },
  approval_escalated: { email: true, in_app: true },
  license_expiring: { email: true, in_app: true },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationSettingsTab({
  showAlert,
}: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: NotificationSettings }>('/admin/notification-settings');
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch {
      showAlert('Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleChannel = (event: string, channel: string) => {
    setSettings(prev => ({
      ...prev,
      [event]: {
        ...(prev[event] || { email: false, in_app: false }),
        [channel]: !((prev[event] as any)?.[channel] ?? false),
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/notification-settings', { settings });
      showAlert('Notification settings saved successfully');
    } catch {
      showAlert('Failed to save notification settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderToggle = (event: string, channel: string) => {
    const enabled = (settings[event] as any)?.[channel] ?? false;
    return (
      <div
        onClick={() => toggleChannel(event, channel)}
        style={{
          width: 40, height: 22, borderRadius: 11, cursor: 'pointer', margin: '0 auto',
          background: enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
          border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
          position: 'relative', transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
          background: enabled ? 'white' : 'var(--text-muted)',
          left: enabled ? 22 : 2, transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }} />
      </div>
    );
  };

  const renderTable = (events: readonly string[], title: string) => (
    <div style={{ marginBottom: events === ITSM_EVENTS ? 0 : 24 }}>
      <h4 style={{
        fontSize: 13, fontWeight: 700, color: 'var(--text)',
        margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {title === 'Ticket Events' ? <Bell size={14} /> : <BellRing size={14} />}
        {title}
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Event</th>
              {CHANNELS.map(ch => (
                <th key={ch} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {ch === 'email' ? <Mail size={12} /> : <Bell size={12} />}
                    {ch.replace('_', ' ')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{
                  padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap',
                }}>
                  {EVENT_LABELS[event] || event}
                </td>
                {CHANNELS.map(ch => (
                  <td key={ch} style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {renderToggle(event, ch)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Description */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bell size={18} />
          </div>
          <div>
            <h3 style={sectionTitle}>Notification Channels</h3>
            <p style={sectionDesc}>
              Configure which events trigger notifications and which channels they are delivered through.
              Email notifications are sent to the user's email address. In-app notifications appear in
              the notification center.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading notification settings...
          </div>
        ) : (
          <>
            {/* Ticket Events */}
            {renderTable(TICKET_EVENTS, 'Ticket Events')}

            {/* ITSM Event Notifications */}
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '16px',
            }}>
              {renderTable(ITSM_EVENTS, 'ITSM Event Notifications')}

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 14px', marginTop: 8,
                background: 'rgba(99,102,241,0.06)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(99,102,241,0.15)',
              }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent)' }} />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  ITSM events include notifications for Problem Management, Change Management,
                  Approval workflows, On-Call schedules, and Software License tracking.
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Info Section */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>About Notification Channels</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Mail size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
            <span>
              <strong style={{ color: 'var(--text)' }}>Email</strong> — Notifications are sent to the user's
              email address. Best for critical events that need immediate attention outside the platform.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Bell size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
            <span>
              <strong style={{ color: 'var(--text)' }}>In-App</strong> — Notifications appear in the
              notification center within the platform. Users can view them when they log in.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--warning)' }} />
            <span>
              Both channels can be enabled simultaneously. Users can also configure their personal
              notification preferences from their profile settings.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
