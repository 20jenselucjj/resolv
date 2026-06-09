'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Key, LogIn, Copy, Check, RefreshCw,
  Eye, EyeOff, AlertTriangle, HelpCircle, Link2
} from 'lucide-react';
import { api } from '@/lib/api';
import { sectionStyle, sectionTitle, sectionDesc } from './admin-styles';

interface LoginModeSectionProps {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  /** 'page' = full login-mode sub-tab; 'inline' = compact section (e.g. directory sync) */
  variant?: 'page' | 'inline';
}

export function LoginModeSection({ showAlert, variant = 'page' }: LoginModeSectionProps) {
  const [loginMode, setLoginMode] = useState<'sso_only' | 'password_only' | 'both'>('both');
  const [emergencyKey, setEmergencyKey] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadMode = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { mode: string; emergencyKey?: string; loginUrl?: string | null } }>('/admin/login-mode');
      if (res.data) {
        setLoginMode(res.data.mode as 'sso_only' | 'password_only' | 'both');
        setEmergencyKey(res.data.emergencyKey || null);
        setLoginUrl(res.data.loginUrl || null);
      }
    } catch {
      // endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMode(); }, [loadMode]);

  const handleChange = async (mode: 'sso_only' | 'password_only' | 'both') => {
    setSaving(true);
    try {
      const res = await api.post<{ data: { mode: string; emergencyKey?: string; loginUrl?: string | null } }>('/admin/login-mode', { mode });
      if (res.data) {
        setLoginMode(res.data.mode as 'sso_only' | 'password_only' | 'both');
        if (res.data.emergencyKey) setEmergencyKey(res.data.emergencyKey);
        if (res.data.loginUrl) setLoginUrl(res.data.loginUrl);
      }
      const labels: Record<string, string> = {
        sso_only: 'SSO Only',
        password_only: 'Password Only',
        both: 'Both (Hybrid)',
      };
      showAlert(`Login mode set to ${labels[mode] || mode}`);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to update login mode', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerating the emergency key will invalidate the current one. Continue?')) return;
    setRegenerating(true);
    try {
      const res = await api.post<{ data: { emergencyKey: string; loginUrl: string } }>('/admin/login-mode/regenerate-emergency-key', {});
      if (res.data) {
        setEmergencyKey(res.data.emergencyKey);
        setLoginUrl(res.data.loginUrl);
      }
      showAlert('Emergency access key regenerated');
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Failed to regenerate emergency key', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showAlert('Failed to copy', 'error');
    });
  };

  // ─── Shared skeleton / loading ─────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  // ─── Page variant (full login mode sub-tab) ────────────────────────────

  if (variant === 'page') {
    const modeOptions = [
      {
        value: 'both' as const,
        title: 'Both (Hybrid)',
        description: 'Users can sign in using either SSO or email/password. Recommended for most setups.',
        icon: <Shield size={18} />,
      },
      {
        value: 'sso_only' as const,
        title: 'SSO Only',
        description: 'Users must sign in using SSO. Password login is disabled for enhanced security.',
        icon: <Key size={18} />,
      },
      {
        value: 'password_only' as const,
        title: 'Password Only',
        description: 'Users sign in with email and password. SSO options are disabled.',
        icon: <LogIn size={18} />,
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Mode Selection */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Login Mode</h3>
          <p style={sectionDesc}>
            Control how users authenticate to the platform. Choose the authentication method
            that best fits your organization's security requirements.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {modeOptions.map(opt => {
              const isSelected = loginMode === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleChange(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                    opacity: saving ? 0.6 : 1,
                    pointerEvents: saving ? 'none' : 'auto',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                    color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {opt.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      {opt.title}
                      {isSelected && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '1px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--accent)', color: '#fff',
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {opt.description}
                    </div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {isSelected && (
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: 'var(--accent)',
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Access Key */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Emergency Access Key</h3>
          <p style={sectionDesc}>
            An emergency access key allows bypassing SSO login in case your identity provider
            is unavailable. Keep this key secure and share only with authorized administrators.
          </p>

          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'rgba(234,179,8,0.12)', color: '#eab308',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  Emergency Access URL
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Use this URL to sign in when your identity provider is unreachable.
                  This URL contains a unique key that grants administrative access.
                </div>
              </div>
            </div>

            {emergencyKey ? (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'monospace', fontSize: 13,
                  color: 'var(--text)',
                  wordBreak: 'break-all',
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {showKey ? emergencyKey : emergencyKey.slice(0, 20) + '••••••••••••••••'}
                  </span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 4,
                      display: 'flex', alignItems: 'center',
                    }}
                    title={showKey ? 'Hide' : 'Show'}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => emergencyKey && handleCopy(emergencyKey)}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Key'}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', color: 'var(--warning)',
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: regenerating ? 'spin 1s linear infinite' : undefined }} />
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center', padding: '24px',
                color: 'var(--text-muted)', fontSize: 13,
              }}>
                <Key size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p>No emergency access key has been generated yet.</p>
                <p style={{ marginTop: 4 }}>Select a login mode above or click below to generate one.</p>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', background: 'var(--accent)', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    marginTop: 12,
                  }}
                >
                  <Key size={14} />
                  Generate Emergency Key
                </button>
              </div>
            )}
          </div>
        </div>

        {/* About Login Modes */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>About Login Modes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
              <span><strong style={{ color: 'var(--text)' }}>Hybrid mode</strong> offers the most flexibility — users can authenticate via SSO or fall back to password login if the IdP is down.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
              <span><strong style={{ color: 'var(--text)' }}>SSO Only</strong> provides the highest security by enforcing identity provider authentication for all users.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
              <span><strong style={{ color: 'var(--text)' }}>Password Only</strong> disables SSO entirely and uses local authentication. Useful during IdP migration or testing.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
              <span>The <strong style={{ color: 'var(--text)' }}>Emergency Access Key</strong> provides a backdoor login URL that works regardless of the login mode. Use it only when you cannot access the platform through normal means.</span>
            </div>
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Inline variant (compact section for directory sync etc.) ──────────

  const inlineOptions = [
    { value: 'both' as const, label: 'Both', description: 'Users can sign in with email/password or SSO', icon: <LogIn size={18} /> },
    { value: 'sso_only' as const, label: 'SSO Only', description: 'Only SSO sign-in allowed. Emergency password login available.', icon: <Link2 size={18} /> },
    { value: 'password_only' as const, label: 'Password Only', description: 'Only email/password sign-in allowed. SSO hidden.', icon: <Key size={18} /> },
  ];

  return (
    <div style={{
      padding: '24px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: 'var(--accent-subtle)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <LogIn size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Login Mode</span>
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
              fontSize: '10px', fontWeight: 600,
              background: loginMode === 'sso_only' ? 'var(--warning-bg)' : loginMode === 'password_only' ? 'var(--accent-subtle)' : 'var(--success-bg)',
              color: loginMode === 'sso_only' ? 'var(--warning)' : loginMode === 'password_only' ? 'var(--accent)' : 'var(--success)',
              border: `1px solid ${loginMode === 'sso_only' ? 'var(--warning-border)' : loginMode === 'password_only' ? 'var(--accent-border)' : 'var(--success-border)'}`,
            }}>
              {loginMode === 'both' ? 'Both' : loginMode === 'sso_only' ? 'SSO Only' : 'Password Only'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 1 }}>
            Control how users sign in to the application
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Mode selector cards */}
        <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {inlineOptions.map(option => (
            <div
              key={option.value}
              onClick={() => handleChange(option.value)}
              style={{
                padding: '16px', borderRadius: 'var(--radius-md)',
                border: `2px solid ${loginMode === option.value ? 'var(--accent)' : 'var(--border)'}`,
                background: loginMode === option.value ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}
            >
              <div style={{ color: loginMode === option.value ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {option.icon}
                <span style={{ fontSize: '13px', fontWeight: 700, color: loginMode === option.value ? 'var(--accent)' : 'var(--text)' }}>
                  {option.label}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {option.description}
              </div>
            </div>
          ))}
        </div>

        {/* Emergency backup URL (only shown for SSO Only) */}
        {loginMode === 'sso_only' && loginUrl && (
          <div style={{
            padding: '16px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={14} color="var(--warning)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)' }}>
                Emergency Password Login URL
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--warning)', opacity: 0.85, marginBottom: 12, lineHeight: 1.5 }}>
              This secret URL allows password login when SSO is unavailable.
              Share it only with trusted administrators. Anyone with this URL
              can bypass SSO to sign in with email and password.
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                flex: '1 1 200px', padding: '10px 14px',
                background: 'var(--bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text)',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {loginUrl}
              </div>
              <button
                onClick={() => handleCopy(loginUrl)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--warning)', color: 'white',
                  border: 'none', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'opacity 0.15s',
                }}
              >
                <Copy size={13} />
                {copied ? 'Copied!' : 'Copy URL'}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid var(--warning-border)',
                  color: 'var(--warning)', fontSize: '12px', fontWeight: 600,
                  cursor: regenerating ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  opacity: regenerating ? 0.7 : 1,
                }}
              >
                <RefreshCw size={12} className={regenerating ? 'ds-spin' : ''} />
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
