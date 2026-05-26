'use client';

import { AlertCircle, Info, RotateCcw } from 'lucide-react';
import type { SyncStatus } from './types';

interface SyncErrorBannerProps {
  syncStatus: SyncStatus | null;
  handleRetrySync: () => void;
  retrying: boolean;
}

function getSyncErrorAdvice(error: string): string {
  const e = error.toLowerCase();
  if (e.includes('oauth') || e.includes('token') || e.includes('invalid_grant') || e.includes('expired'))
    return 'Reconnect OAuth by clicking "Re-authenticate" above, then try again.';
  if (e.includes('client_id') || e.includes('client_secret') || e.includes('invalid_client'))
    return 'Check your Client ID and Client Secret in the Provider Configuration section above.';
  if (e.includes('admin sdk') || e.includes('api') || e.includes('scope') || e.includes('permission'))
    return 'Enable the Admin SDK API in Google Cloud Console, and ensure the OAuth consent screen includes the correct scopes.';
  if (e.includes('domain') || e.includes('workspace') || e.includes('hd'))
    return 'Verify your Google Workspace domain is correct and has active user accounts.';
  if (e.includes('network') || e.includes('econnrefused') || e.includes('timeout') || e.includes('dns'))
    return 'A network error occurred. Check your internet connection and ensure the API can reach Google servers.';
  if (e.includes('not found') || e.includes('404'))
    return 'The directory resource was not found. Verify your domain and API configuration.';
  if (e.includes('rate') || e.includes('quota') || e.includes('limit') || e.includes('429'))
    return 'Google API rate limit hit. Wait a few minutes before retrying.';
  return 'Check the configuration above and ensure OAuth is connected properly.';
}

export function SyncErrorBanner({ syncStatus, handleRetrySync, retrying }: SyncErrorBannerProps) {
  if (!syncStatus?.error) return null;
  const advice = getSyncErrorAdvice(syncStatus.error);
  return (
    <div className="ds-fade-in" style={{
      padding: '16px 20px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--danger-bg)',
      border: '1px solid var(--danger-border)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>Sync Error</div>
        <div style={{ fontSize: '12px', color: 'var(--danger)', lineHeight: 1.5, opacity: 0.85, marginBottom: 8 }}>{syncStatus.error}</div>
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--radius-md)',
          background: 'rgba(0,0,0,0.06)',
          fontSize: '12px', color: 'var(--danger)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><strong>Suggestion:</strong> {advice}</span>
        </div>
      </div>
      <button
        onClick={handleRetrySync}
        disabled={retrying}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '7px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--danger)', color: 'white',
          border: 'none', fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', flexShrink: 0,
          opacity: retrying ? 0.7 : 1,
          boxShadow: '0 2px 6px rgba(var(--danger-rgb), 0.3)',
        }}
      >
        <RotateCcw size={12} className={retrying ? 'ds-spin' : ''} />
        {retrying ? 'Retrying...' : 'Retry Sync'}
      </button>
    </div>
  );
}
