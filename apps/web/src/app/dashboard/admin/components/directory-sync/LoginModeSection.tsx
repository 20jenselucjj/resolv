'use client';

import { LogIn, Link2, Key, AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { Section } from './Section';

interface LoginModeSectionProps {
  loginMode: 'both' | 'sso_only' | 'password_only';
  handleLoginModeChange: (mode: 'both' | 'sso_only' | 'password_only') => void;
  loginModeSaving: boolean;
  emergencyLoginUrl: string | null;
  handleCopyUrl: (url: string) => void;
  copied: boolean;
  handleRegenerateEmergencyKey: () => void;
  regeneratingKey: boolean;
}

export function LoginModeSection({
  loginMode, handleLoginModeChange, loginModeSaving,
  emergencyLoginUrl, handleCopyUrl, copied,
  handleRegenerateEmergencyKey, regeneratingKey,
}: LoginModeSectionProps) {
  return (
    <Section
      icon={<LogIn size={16} />}
      iconBg="var(--accent-subtle)"
      iconColor="var(--accent)"
      label="Login Mode"
      description="Control how users sign in to the application"
      badge={
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          fontSize: '10px', fontWeight: 600,
          background: loginMode === 'sso_only' ? 'var(--warning-bg)' : loginMode === 'password_only' ? 'var(--accent-subtle)' : 'var(--success-bg)',
          color: loginMode === 'sso_only' ? 'var(--warning)' : loginMode === 'password_only' ? 'var(--accent)' : 'var(--success)',
          border: `1px solid ${loginMode === 'sso_only' ? 'var(--warning-border)' : loginMode === 'password_only' ? 'var(--accent-border)' : 'var(--success-border)'}`,
        }}>
          {loginMode === 'both' ? 'Both' : loginMode === 'sso_only' ? 'SSO Only' : 'Password Only'}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Mode selector cards */}
        <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {([
            { value: 'both' as const, label: 'Both', description: 'Users can sign in with email/password or SSO', icon: <LogIn size={18} /> },
            { value: 'sso_only' as const, label: 'SSO Only', description: 'Only SSO sign-in allowed. Emergency password login available.', icon: <Link2 size={18} /> },
            { value: 'password_only' as const, label: 'Password Only', description: 'Only email/password sign-in allowed. SSO hidden.', icon: <Key size={18} /> },
          ]).map(option => (
            <div
              key={option.value}
              onClick={() => handleLoginModeChange(option.value)}
              style={{
                padding: '16px', borderRadius: 'var(--radius-md)',
                border: `2px solid ${loginMode === option.value ? 'var(--accent)' : 'var(--border)'}`,
                background: loginMode === option.value ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                cursor: loginModeSaving ? 'wait' : 'pointer',
                opacity: loginModeSaving ? 0.7 : 1,
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
        {loginMode === 'sso_only' && emergencyLoginUrl && (
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
                {emergencyLoginUrl}
              </div>
              <button
                onClick={() => handleCopyUrl(emergencyLoginUrl)}
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
                onClick={handleRegenerateEmergencyKey}
                disabled={regeneratingKey}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid var(--warning-border)',
                  color: 'var(--warning)', fontSize: '12px', fontWeight: 600,
                  cursor: regeneratingKey ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  opacity: regeneratingKey ? 0.7 : 1,
                }}
              >
                <RefreshCw size={12} className={regeneratingKey ? 'ds-spin' : ''} />
                {regeneratingKey ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
