'use client';

import { AlertTriangle, CheckCircle, Users, Globe, Timer, AlertCircle, RefreshCw, Unlink } from 'lucide-react';
import type { DirectorySyncConfig, SyncStatus } from './types';

interface TokenExpiryInfo {
  isExpired: boolean;
  isExpiringSoon: boolean;
  hoursLeft: number;
}

interface ConnectedStatusBannerProps {
  config: DirectorySyncConfig;
  tokenExpiry: TokenExpiryInfo | null;
  syncStatus: SyncStatus | null;
  handleReauthenticate: () => void;
  handleDisconnectOAuth: () => void;
  disconnecting: boolean;
  formatDateTime: (dateStr?: string) => string;
}

export function ConnectedStatusBanner({
  config, tokenExpiry, syncStatus,
  handleReauthenticate, handleDisconnectOAuth,
  disconnecting, formatDateTime,
}: ConnectedStatusBannerProps) {
  const hasIssue = tokenExpiry?.isExpired || tokenExpiry?.isExpiringSoon || syncStatus?.status === 'error';

  return (
    <div className="ds-fade-in" style={{
      padding: '20px 24px',
      border: `1px solid ${hasIssue ? 'var(--warning-border)' : 'var(--success-border)'}`,
      borderRadius: 'var(--radius-lg)',
      background: hasIssue
        ? 'linear-gradient(135deg, var(--warning-bg) 0%, var(--bg) 100%)'
        : 'linear-gradient(135deg, var(--success-bg) 0%, var(--bg) 100%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        {/* Left: Connection info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 'var(--radius-lg)',
            background: hasIssue ? 'var(--warning-bg)' : 'var(--success-bg)',
            color: hasIssue ? 'var(--warning)' : 'var(--success)',
            flexShrink: 0,
          }}>
            {hasIssue ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                {config.oauthProvider || 'Google Workspace'}
              </span>
              <span style={{
                padding: '2px 10px', borderRadius: 'var(--radius-full)',
                fontSize: '11px', fontWeight: 600,
                background: hasIssue ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: hasIssue ? 'var(--warning)' : 'var(--success)',
                border: `1px solid ${hasIssue ? 'var(--warning-border)' : 'var(--success-border)'}`,
              }}>
                {hasIssue ? (tokenExpiry?.isExpired ? 'Token Expired' : 'Attention Needed') : 'Connected'}
              </span>
            </div>

            {/* Detail rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 4 }}>
              {config.oauthEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <Users size={12} style={{ flexShrink: 0 }} />
                  <span>Account: <strong style={{ color: 'var(--text)' }}>{config.oauthEmail}</strong></span>
                </div>
              )}
              {config.oauthDomain && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <Globe size={12} style={{ flexShrink: 0 }} />
                  <span>Domain: <strong style={{ color: 'var(--text)' }}>{config.oauthDomain}</strong></span>
                </div>
              )}
              {config.tokenExpiresAt && tokenExpiry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: tokenExpiry.isExpired ? 'var(--danger)' : tokenExpiry.isExpiringSoon ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  <Timer size={12} style={{ flexShrink: 0 }} />
                  <span>
                    Token {tokenExpiry.isExpired ? 'expired' : 'expires'}: <strong>{formatDateTime(config.tokenExpiresAt)}</strong>
                    {!tokenExpiry.isExpired && tokenExpiry.isExpiringSoon && (
                      <span style={{ marginLeft: 6, color: 'var(--warning)' }}>({Math.round(tokenExpiry.hoursLeft)}h remaining)</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Warning for expiring/expired token */}
            {tokenExpiry && (tokenExpiry.isExpired || tokenExpiry.isExpiringSoon) && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                background: tokenExpiry.isExpired ? 'var(--danger-bg)' : 'var(--warning-bg)',
                border: `1px solid ${tokenExpiry.isExpired ? 'var(--danger-border)' : 'var(--warning-border)'}`,
                fontSize: '12px', color: tokenExpiry.isExpired ? 'var(--danger)' : 'var(--warning)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>
                  {tokenExpiry.isExpired
                    ? 'OAuth token has expired. Re-authenticate to restore sync functionality.'
                    : 'OAuth token is expiring soon. Re-authenticate to avoid sync interruptions.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {(tokenExpiry?.isExpired || tokenExpiry?.isExpiringSoon) && (
            <button
              onClick={handleReauthenticate}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)', color: 'white',
                border: 'none', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.15s',
                boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)',
              }}
            >
              <RefreshCw size={13} />
              Re-authenticate
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={handleDisconnectOAuth}
            disabled={disconnecting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', color: 'var(--danger)',
              fontSize: '12px', fontWeight: 500,
            }}
          >
            <Unlink size={13} />
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}
