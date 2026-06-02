'use client';

import { useEffect, useState } from 'react';
import { Mail, Save, Play, Power } from 'lucide-react';
import { api } from '@/lib/api';

interface InboundConfig {
  enabled: string;
  host: string;
  port: string;
  user: string;
  password: string;
  poll_interval: string;
  folder: string;
  processed_folder: string;
  ticket_creation_enabled: string;
  reply_enabled: string;
}

export function EmailInboundTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<InboundConfig>({
    enabled: 'false',
    host: '',
    port: '993',
    user: '',
    password: '',
    poll_interval: '60',
    folder: 'INBOX',
    processed_folder: 'Processed',
    ticket_creation_enabled: 'false',
    reply_enabled: 'false',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/email/inbound/config')
      .then(res => {
        if (res.data) {
          setConfig(prev => ({
            ...prev,
            ...res.data,
          }));
        }
      })
      .catch(() => showAlert('Failed to load inbound email config', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/admin/email/inbound/config', config);
      showAlert('Inbound email settings saved');
    } catch {
      showAlert('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/admin/email/inbound/test', {});
      if (res.success) {
        showAlert('Inbound poll complete');
      } else {
        showAlert(res.message || 'Poll failed', 'error');
      }
    } catch (err: any) {
      showAlert(err.message || 'Test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Enable/Disable */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Enable Inbound Email Processing</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>When enabled, the server will poll the IMAP inbox for new emails</div>
          </div>
          <button
            onClick={() => update('enabled', config.enabled === 'true' ? 'false' : 'true')}
            style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: config.enabled === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
              position: 'absolute', top: 3,
              left: config.enabled === 'true' ? 25 : 3,
              transition: 'left 0.2s ease',
            }} />
          </button>
        </div>
      </div>

      {/* IMAP Connection */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={14} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>IMAP Connection</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>IMAP Host</label>
            <input style={inputStyle} value={config.host} onChange={e => update('host', e.target.value)} placeholder="imap.gmail.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Port</label>
            <input style={inputStyle} value={config.port} onChange={e => update('port', e.target.value)} placeholder="993" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Username / Email</label>
            <input style={inputStyle} value={config.user} onChange={e => update('user', e.target.value)} placeholder="support@yourcompany.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>App Password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={inputStyle}
                type={showPassword ? 'text' : 'password'}
                value={config.password}
                onChange={e => update('password', e.target.value)}
                placeholder="Gmail app password"
              />
              <button className="btn btn-ghost" onClick={() => setShowPassword(!showPassword)} style={{ padding: '0 8px', fontSize: 11, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              For Gmail: use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>App Password</a>
            </div>
          </div>
        </div>
      </div>

      {/* Polling Settings */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Polling & Routing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Poll Interval (seconds)</label>
            <input style={inputStyle} type="number" value={config.poll_interval} onChange={e => update('poll_interval', e.target.value)} min="10" placeholder="60" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Inbox Folder</label>
            <input style={inputStyle} value={config.folder} onChange={e => update('folder', e.target.value)} placeholder="INBOX" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Processed Folder</label>
            <input style={inputStyle} value={config.processed_folder} onChange={e => update('processed_folder', e.target.value)} placeholder="Processed" />
          </div>
        </div>
      </div>

      {/* Ticket Creation Settings */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Email Processing Rules</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Create tickets from emails without a ticket number</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Emails with no ticket # in the subject will create new tickets automatically</div>
            </div>
            <button
              onClick={() => update('ticket_creation_enabled', config.ticket_creation_enabled === 'true' ? 'false' : 'true')}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: config.ticket_creation_enabled === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                position: 'absolute', top: 3,
                left: config.ticket_creation_enabled === 'true' ? 25 : 3,
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Process replies to existing tickets</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Emails with a ticket number in the subject (e.g., &quot;Re: Ticket #1042&quot;) will add comments</div>
            </div>
            <button
              onClick={() => update('reply_enabled', config.reply_enabled === 'true' ? 'false' : 'true')}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: config.reply_enabled === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                position: 'absolute', top: 3,
                left: config.reply_enabled === 'true' ? 25 : 3,
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={handleTest} disabled={testing} style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={14} />
          {testing ? 'Testing...' : 'Test Poll Now'}
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
