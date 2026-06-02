'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminSetting } from './types';

export function SettingsTab({ settings, onRefresh, showAlert }: { settings: AdminSetting[]; onRefresh: () => void; showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [smtpForm, setSmtpForm] = useState({ host: '', port: '', secure: 'false', user: '', password: '', from_email: '', from_name: '' });
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const values: Record<string, string> = {};
    settings.forEach(s => {
      values[s.key] = s.value;
    });
    setLocalValues(values);
    setSmtpForm({
      host: settings.find(s => s.key === 'smtp_host')?.value || '',
      port: settings.find(s => s.key === 'smtp_port')?.value || '587',
      secure: settings.find(s => s.key === 'smtp_secure')?.value || 'false',
      user: settings.find(s => s.key === 'smtp_user')?.value || '',
      password: '',
      from_email: settings.find(s => s.key === 'smtp_from_email')?.value || '',
      from_name: settings.find(s => s.key === 'smtp_from_name')?.value || '',
    });
  }, [settings]);

  const handleSave = async (key: string) => {
    setSavingKeys(prev => new Set(prev).add(key));
    try {
      await api.patch('/admin/settings', { key, value: localValues[key] });
      showAlert('Setting saved');
      onRefresh();
    } catch (err) {
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

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const res = await api.post<{ data: { success: boolean; message: string } }>('/admin/settings/test-smtp', {
        host: smtpForm.host,
        port: parseInt(smtpForm.port) || 587,
        secure: smtpForm.secure === 'true',
        user: smtpForm.user,
        password: smtpForm.password,
      });
      setSmtpResult(res.data);
    } catch (err: any) {
      setSmtpResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSaveSmtp = async () => {
    const keys = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_from_email', 'smtp_from_name'];
    if (smtpForm.password) keys.push('smtp_password');

    const values: Record<string, string> = {
      smtp_host: smtpForm.host,
      smtp_port: smtpForm.port,
      smtp_secure: smtpForm.secure,
      smtp_user: smtpForm.user,
      smtp_from_email: smtpForm.from_email,
      smtp_from_name: smtpForm.from_name,
    };
    if (smtpForm.password) values.smtp_password = smtpForm.password;

    try {
      for (const key of keys) {
        await api.patch('/admin/settings', { key, value: values[key] || '' });
      }
      showAlert('SMTP settings saved');
      onRefresh();
    } catch {
      showAlert('Failed to save SMTP settings', 'error');
    }
  };

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

      <div style={{ marginTop: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, paddingBottom: 8, borderBottom: '2px solid var(--border)' }}>SMTP / Email Server</h3>
        <div className="card">
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SMTP Host</label>
                <input className="input" value={smtpForm.host} onChange={e => setSmtpForm({...smtpForm, host: e.target.value})} placeholder="smtp.example.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SMTP Port</label>
                <input className="input" value={smtpForm.port} onChange={e => setSmtpForm({...smtpForm, port: e.target.value})} placeholder="587" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Security</label>
                <select className="select" value={smtpForm.secure} onChange={e => setSmtpForm({...smtpForm, secure: e.target.value})} style={{ width: '100%' }}>
                  <option value="false">STARTTLS</option>
                  <option value="true">SSL/TLS</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Username</label>
                <input className="input" value={smtpForm.user} onChange={e => setSmtpForm({...smtpForm, user: e.target.value})} placeholder="user@example.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Password</label>
                <input className="input" type="password" value={smtpForm.password} onChange={e => setSmtpForm({...smtpForm, password: e.target.value})} placeholder="Leave blank to keep current" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>From Email</label>
                <input className="input" value={smtpForm.from_email} onChange={e => setSmtpForm({...smtpForm, from_email: e.target.value})} placeholder="support@company.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>From Name</label>
                <input className="input" value={smtpForm.from_name} onChange={e => setSmtpForm({...smtpForm, from_name: e.target.value})} placeholder="IT Support" />
              </div>
            </div>

            {smtpResult && (
              <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: smtpResult.success ? 'var(--success-bg)' : 'var(--danger-bg)', color: smtpResult.success ? 'var(--success)' : 'var(--danger)', border: `1px solid ${smtpResult.success ? 'var(--success-border)' : 'var(--danger-border)'}`, fontSize: 13 }}>
                {smtpResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={handleTestSmtp} disabled={testingSmtp || !smtpForm.host} style={{ border: '1px solid var(--border)' }}>
                {testingSmtp ? 'Testing...' : 'Test Connection'}
              </button>
              <button className="btn btn-primary" onClick={handleSaveSmtp}>Save SMTP Settings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
