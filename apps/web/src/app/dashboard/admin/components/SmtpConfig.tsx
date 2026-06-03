'use client';

import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { api, API_BASE } from '@/lib/api';

interface OAuthStatus {
  connected: boolean;
  connectedVia: 'smtp_oauth' | 'directory_sync' | null;
  provider: string | null;
  email: string | null;
  expiresAt: string | null;
  configured: boolean;
  dsCredentialsAvailable: boolean;
}

export function SmtpConfig({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OAuthStatus>({
    connected: false, connectedVia: null, provider: null, email: null,
    expiresAt: null, configured: false, dsCredentialsAvailable: false,
  });
  const [oauthConfig, setOAuthConfig] = useState({ clientId: '', clientSecret: '' });
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [savingOAuthConfig, setSavingOAuthConfig] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManualSetup, setShowManualSetup] = useState(false);

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get<{ data: OAuthStatus }>('/admin/email/oauth-status');
      setStatus(res.data);
      // Load any saved smtp_oauth_config for the manual setup form
      const configRes = await api.get<{ data: { key: string; value: string }[] }>('/admin/settings');
      const configVal = configRes.data.find((s: any) => s.key === 'smtp_oauth_config');
      if (configVal) {
        const parsed = JSON.parse(configVal.value);
        setOAuthConfig({
          clientId: parsed.clientId || '',
          clientSecret: parsed.clientSecret || '',
        });
      }
    } catch { /* ignore */ }
  };

  // Listen for OAuth popup messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'email-oauth-connected') {
        fetchStatus();
        showAlert('Google Workspace connected successfully', 'success');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleOAuthConnect = () => {
    const url = `${API_BASE}/oauth/outbound/authorize?provider=google`;
    const w = 600; const h = 700;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(url, 'oauth-outbound', `width=${w},height=${h},left=${left},top=${top}`);
  };

  const handleOAuthDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.post('/oauth/outbound/disconnect', {});
      await fetchStatus();
      showAlert('Outbound email disconnected', 'success');
    } catch {
      showAlert('Failed to disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveOAuthConfig = async () => {
    setSavingOAuthConfig(true);
    try {
      const config = {
        clientId: oauthConfig.clientId,
        clientSecret: oauthConfig.clientSecret,
        provider: 'google',
        connected: status.connected,
        email: status.email || null,
        tokenExpiresAt: status.expiresAt || null,
      };
      await api.patch('/admin/settings', { key: 'smtp_oauth_config', value: JSON.stringify(config) });
      await fetchStatus();
      showAlert('OAuth credentials saved. You can now connect.', 'success');
    } catch {
      showAlert('Failed to save OAuth credentials', 'error');
    } finally {
      setSavingOAuthConfig(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 'var(--radius-md)',
            background: 'var(--accent-subtle)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={14} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Outbound Email</div>
        </div>

        {status.connected && status.connectedVia === 'directory_sync' ? (
          <>
            {/* ── Connected via Directory Sync ── */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: '#e6f4ea', border: '1px solid #a8dab5',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#1e7e34', fontWeight: 700, fontSize: 14 }}>{'\u2714'} Connected via Directory Sync</span>
              </div>
              <div style={{ fontSize: 13, color: '#3c7649', lineHeight: 1.6 }}>
                Outbound email uses the same Google Workspace connection as Directory Sync.
                Emails are sent from <strong>{status.email || 'your connected account'}</strong>.
                No additional setup needed.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowManualSetup(true)}
                style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--border)' }}
              >
                Configure separately
              </button>
            </div>
          </>
        ) : status.connected && status.connectedVia === 'smtp_oauth' ? (
          <>
            {/* ── Connected via Dedicated OAuth ── */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: '#e6f4ea', border: '1px solid #a8dab5',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#1e7e34', fontWeight: 700, fontSize: 14 }}>{'\u2714'} Connected</span>
              </div>
              <div style={{ fontSize: 13, color: '#3c7649', lineHeight: 1.6 }}>
                Emails are sent from <strong>{status.email || 'your connected account'}</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {status.dsCredentialsAvailable && (
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await handleOAuthDisconnect();
                    showAlert('Switched to Directory Sync connection. No credentials needed.', 'success');
                  }}
                  style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--border)' }}
                >
                  Use Directory Sync instead
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={handleOAuthDisconnect}
                disabled={disconnecting}
                style={{
                  border: '1px solid var(--danger-border)', color: 'var(--danger)',
                  fontSize: 12, padding: '4px 12px',
                }}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </>
        ) : status.configured && !showManualSetup ? (
          <>
            {/* ── Credentials saved, not yet connected ── */}
            <div style={{
              fontSize: 13, color: 'var(--text-secondary)',
              padding: '10px 14px', background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)', lineHeight: 1.6,
            }}>
              OAuth credentials are saved. Click Connect to authorize email sending via Google.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleOAuthConnect}>
                Connect
              </button>
            </div>
            {status.dsCredentialsAvailable && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowManualSetup(true)}
                  style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--border)' }}
                >
                  Change credentials
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── No connection — manual setup ── */}
            <div style={{
              fontSize: 13, color: 'var(--text-secondary)',
              padding: '10px 14px', background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)', lineHeight: 1.6,
            }}>
              To send emails, connect a Google Workspace account. You&apos;ll need OAuth 2.0 credentials
              from the{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                Google Cloud Console
              </a>
              {' '}(Web application type).
            </div>

            {/* Client ID */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Client ID</label>
              <input className="input" value={oauthConfig.clientId} onChange={e => setOAuthConfig(prev => ({ ...prev, clientId: e.target.value }))} placeholder="Your Google OAuth Client ID" />
            </div>

            {/* Client Secret */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Client Secret</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showClientSecret ? 'text' : 'password'} value={oauthConfig.clientSecret} onChange={e => setOAuthConfig(prev => ({ ...prev, clientSecret: e.target.value }))} placeholder="Your Google OAuth Client Secret" style={{ paddingRight: 70 }} />
                <button onClick={() => setShowClientSecret(!showClientSecret)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {showClientSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {status.dsCredentialsAvailable && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowManualSetup(false)}
                  style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--border)' }}
                >
                  Cancel — use Directory Sync
                </button>
              )}
              <button className="btn btn-primary" onClick={handleSaveOAuthConfig} disabled={savingOAuthConfig || !oauthConfig.clientId || !oauthConfig.clientSecret}>
                {savingOAuthConfig ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
