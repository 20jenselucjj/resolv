'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Users, Globe, Timer, AlertCircle, RefreshCw, Unlink, ChevronDown } from 'lucide-react';
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
  const isTokenExpired = tokenExpiry?.isExpired === true;
  const hasIssue = isTokenExpired || syncStatus?.status === 'error';
  const [detailsOpen, setDetailsOpen] = useState(hasIssue);

  // Auto-open details if an issue arises after mount
  useEffect(() => {
    if (hasIssue) setDetailsOpen(true);
  }, [hasIssue]);

  const hasDetails = !!(config.oauthEmail || config.oauthDomain || (config.tokenExpiresAt && tokenExpiry));

  return (
    <div className="ds-fade-in ds-banner-mobile" style={{
      padding: '20px 24px',
      border: `1px solid ${hasIssue ? 'var(--warning-border)' : 'var(--success-border)'}`,
      borderRadius: 'var(--radius-lg)',
      background: hasIssue
        ? 'linear-gradient(135deg, var(--warning-bg) 0%, var(--bg) 100%)'
        : 'linear-gradient(135deg, var(--success-bg) 0%, var(--bg) 100%)',
    }}>
      {/* Top row: icon + provider + status + actions — always visible */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 'var(--radius-lg)',
            background: hasIssue ? 'var(--warning-bg)' : 'var(--success-bg)',
            color: hasIssue ? 'var(--warning)' : 'var(--success)',
            flexShrink: 0,
          }}>
            {hasIssue ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '14px', fontWeight: 700, color: 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {config.oauthProvider || 'Google Workspace'}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap',
                background: hasIssue ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: hasIssue ? 'var(--warning)' : 'var(--success)',
                border: `1px solid ${hasIssue ? 'var(--warning-border)' : 'var(--success-border)'}`,
              }}>
                {hasIssue ? (isTokenExpired ? 'Expired' : 'Issue') : 'Connected'}
              </span>
            </div>

            {/* Token auto-refresh note — reassuring, not alarming */}
            {!isTokenExpired && (
              <div style={{
                marginTop: 4, fontSize: '11px', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <RefreshCw size={11} style={{ flexShrink: 0 }} />
                <span>Token renews automatically</span>
              </div>
            )}

            {/* Only show warning when token is actually expired */}
            {isTokenExpired && (
              <div style={{
                marginTop: 4, fontSize: '11px', color: 'var(--danger)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <AlertCircle size={12} style={{ flexShrink: 0 }} />
                <span>Token expired. Re-authenticate.</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions + detail toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {isTokenExpired && (
            <button
              onClick={handleReauthenticate}
              className="resp-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)', color: 'white',
                border: 'none', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <RefreshCw size={12} />
              <span className="hide-mobile">Re-authenticate</span>
              <span className="show-mobile">Re-auth</span>
            </button>
          )}
          <button
            onClick={handleDisconnectOAuth}
            disabled={disconnecting}
            aria-label="Disconnect OAuth"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', color: 'var(--danger)',
              background: 'transparent', border: '1px solid transparent',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: '12px', fontWeight: 500,
              whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
          >
            <Unlink size={12} />
            <span className="hide-mobile">{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
            <span className="show-mobile">Disc.</span>
          </button>
          {hasDetails && (
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? 'Hide connection details' : 'Show connection details'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 'var(--radius-md)',
                background: 'transparent', border: '1px solid var(--border)',
                cursor: 'pointer', color: 'var(--text-muted)',
                transition: 'all 0.15s', flexShrink: 0,
                transform: detailsOpen ? 'rotate(180deg)' : 'none',
              }}
              title={detailsOpen ? 'Hide details' : 'Show details'}
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible details */}
      {hasDetails && (
        <div className={`ds-banner-details${detailsOpen ? ' open' : ''}`} style={{
          transition: 'max-height 0.3s ease, margin-top 0.3s ease, opacity 0.2s ease',
          maxHeight: detailsOpen ? '300px' : '0',
          overflow: 'hidden',
          marginTop: detailsOpen ? '12px' : '0',
          opacity: detailsOpen ? 1 : 0,
        }}>
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: isTokenExpired ? 'var(--danger)' : 'var(--text-secondary)' }}>
                <Timer size={12} style={{ flexShrink: 0 }} />
                <span>
                  Access token {isTokenExpired ? 'expired' : 'renews'}: <strong>{formatDateTime(config.tokenExpiresAt)}</strong>
                  {!isTokenExpired && ' (auto-refreshes)'}
                </span>
              </div>
            )}
            {/* Full warning only when token is actually expired */}
            {isTokenExpired && (
              <div style={{
                marginTop: 4, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                fontSize: '12px', color: 'var(--danger)',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  OAuth token has expired. Re-authenticate to restore sync and email functionality.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
