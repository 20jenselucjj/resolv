'use client';

import { useEffect, useState } from 'react';
import { Save, Bell, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminSetting } from './types';
import { ToggleSwitch } from './ToggleSwitch';

export function SettingsTab({ settings, onRefresh, showAlert }: { settings: AdminSetting[]; onRefresh: () => void; showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

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
                <div style={{ width: '250px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {s.type === 'boolean' ? (
                    <ToggleSwitch
                      enabled={localValues[s.key] === 'true'}
                      onChange={() => {
                        const newVal = localValues[s.key] === 'true' ? 'false' : 'true';
                        setLocalValues(prev => ({ ...prev, [s.key]: newVal }));
                      }}
                    />
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

      {/* Notification Settings — Cross-link */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: '16px 0 0 0', fontSize: '16px', fontWeight: 700, paddingBottom: '8px', borderBottom: '2px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} /> Notifications
        </h3>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Bell size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Notification settings moved
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Configure email and in-app notification preferences for ticket events, SLA breaches, and ITSM processes in the dedicated Notifications tab.
              </p>
            </div>
            <a
              href="/dashboard/admin?tab=notification-settings"
              style={{
                padding: '8px 16px', background: 'var(--accent)', color: '#fff',
                borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              <ExternalLink size={14} />
              Go to Notifications
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
