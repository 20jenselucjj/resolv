'use client';

import { useEffect, useState } from 'react';
import { Save, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminSetting, NotificationSettings } from './types';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
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

const NOTIF_CHANNELS = ['email', 'in_app'] as const;

export function SettingsTab({ settings, onRefresh, showAlert }: { settings: AdminSetting[]; onRefresh: () => void; showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: NotificationSettings }>('/admin/notification-settings')
      .then(res => { if (res.data) setNotifSettings(res.data); })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  const toggleNotifChannel = (event: string, channel: string) => {
    setNotifSettings(prev => ({
      ...prev,
      [event]: { ...prev[event as keyof NotificationSettings], [channel]: !(prev[event as keyof NotificationSettings] as any)[channel] }
    } as NotificationSettings));
  };

  const handleSaveNotif = async () => {
    setNotifSaving(true);
    try {
      await api.put('/admin/notification-settings', { settings: notifSettings });
      showAlert('Notification settings saved');
    } catch {
      showAlert('Failed to save notification settings', 'error');
    } finally {
      setNotifSaving(false);
    }
  };

  // Sync settings into local state
  useEffect(() => {
    const values: Record<string, string> = {};
    settings.forEach(s => {
      values[s.key] = s.value;
    });
    setLocalValues(values);
  }, [settings]);

  const handleSave = async (key: string) => {
    setSavingKeys(prev => new Set(prev).add(key));
    try {
      await api.patch('/admin/settings', { key, value: localValues[key] });
      showAlert('Setting saved');
      onRefresh();
    } catch {
      showAlert('Failed to save', 'error');
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const groupedSettings = settings.reduce((acc, curr) => {
    const group = curr.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(curr);
    return acc;
  }, {} as Record<string, AdminSetting[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {Object.entries(groupedSettings).map(([group, groupSettings]) => (
        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, paddingBottom: '8px', borderBottom: '2px solid var(--border)' }}>{group}</h3>
          <div className="card">
            {groupSettings.map((s, idx) => (
              <div key={s.key} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '24px', borderBottom: idx < groupSettings.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.key}</div>
                </div>
                <div style={{ width: '250px', display: 'flex', gap: '8px' }}>
                  {s.type === 'boolean' ? (
                    <select
                      className="select"
                      value={localValues[s.key] ?? s.value}
                      onChange={(e) => setLocalValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={s.type === 'number' ? 'number' : 'text'}
                      value={localValues[s.key] ?? s.value}
                      onChange={(e) => setLocalValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    />
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--accent)' }}
                    onClick={() => handleSave(s.key)}
                    disabled={savingKeys.has(s.key)}
                  >
                    {savingKeys.has(s.key) ? (
                      <div className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                    ) : (
                      <Save size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Notification Channels Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: '16px 0 0 0', fontSize: '16px', fontWeight: 700, paddingBottom: '8px', borderBottom: '2px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} /> Notification Channels
        </h3>
        <div className="card" style={{ padding: '24px' }}>
          {notifLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Event</th>
                      {NOTIF_CHANNELS.map(ch => (
                        <th key={ch} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ch.replace('_', ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(notifSettings).map(([event, channels]) => (
                      <tr key={event} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{EVENT_LABELS[event] || event}</td>
                        {NOTIF_CHANNELS.map(ch => (
                          <td key={ch} style={{ padding: '12px 16px', textAlign: 'center' }} onClick={() => toggleNotifChannel(event, ch)}>
                            <div style={{
                              width: 40, height: 22, borderRadius: 11, cursor: 'pointer', margin: '0 auto',
                              background: (channels as any)[ch] ? 'var(--accent)' : 'var(--bg-tertiary)',
                              border: `1px solid ${(channels as any)[ch] ? 'var(--accent)' : 'var(--border)'}`,
                              position: 'relative', transition: 'all 0.2s ease'
                            }}>
                              <div style={{
                                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                                background: (channels as any)[ch] ? 'white' : 'var(--text-muted)',
                                left: (channels as any)[ch] ? 22 : 2, transition: 'left 0.2s ease',
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={handleSaveNotif} disabled={notifSaving} style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Save size={16} /> {notifSaving ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
