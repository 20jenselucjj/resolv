'use client';

import { useEffect, useState } from 'react';
import { Bell, Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { NotificationSettings } from './types';

const DEFAULT_SETTINGS: NotificationSettings = {
  ticket_created: { email: true, in_app: true },
  ticket_assigned: { email: true, in_app: true },
  ticket_updated: { email: false, in_app: true },
  ticket_resolved: { email: true, in_app: true },
  sla_breach: { email: true, in_app: true },
  comment_added: { email: false, in_app: true },
};

const EVENT_LABELS: Record<string, string> = {
  ticket_created: 'Ticket Created',
  ticket_assigned: 'Ticket Assigned',
  ticket_updated: 'Ticket Updated',
  ticket_resolved: 'Ticket Resolved',
  sla_breach: 'SLA Breach',
  comment_added: 'Comment Added',
};

const CHANNELS = ['email', 'in_app'] as const;

export function NotificationSettingsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: NotificationSettings }>('/admin/notification-settings')
      .then(res => { if (res.data) setSettings(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (event: string, channel: string) => {
    setSettings(prev => ({
      ...prev,
      [event]: { ...prev[event as keyof NotificationSettings], [channel]: !prev[event as keyof NotificationSettings][channel as keyof typeof prev[keyof NotificationSettings]] }
    } as NotificationSettings));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/notification-settings', { settings });
      showAlert('Notification settings saved');
    } catch {
      showAlert('Failed to save notification settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Event</th>
                {CHANNELS.map(ch => (
                  <th key={ch} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ch.replace('_', ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(settings).map(([event, channels]) => (
                <tr key={event} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{EVENT_LABELS[event] || event}</td>
                  {CHANNELS.map(ch => (
                    <td key={ch} style={{ padding: '12px 16px', textAlign: 'center' }} onClick={() => toggle(event, ch)}>
                      <div style={{
                        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', margin: '0 auto',
                        background: channels[ch as keyof typeof channels] ? 'var(--accent)' : 'var(--bg-tertiary)',
                        border: `1px solid ${channels[ch as keyof typeof channels] ? 'var(--accent)' : 'var(--border)'}`,
                        position: 'relative', transition: 'all 0.2s ease'
                      }}>
                        <div style={{
                          position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                          background: channels[ch as keyof typeof channels] ? 'white' : 'var(--text-muted)',
                          left: channels[ch as keyof typeof channels] ? 22 : 2, transition: 'left 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
