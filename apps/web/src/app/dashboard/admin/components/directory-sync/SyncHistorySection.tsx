'use client';

import { Database, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import type { SyncLogEntry } from './types';
import { EmptyState } from './EmptyState';
import { Section } from './Section';
import { formatRelativeTime, formatDateTime, formatDuration } from './helpers';

interface SyncHistorySectionProps {
  syncLogs: SyncLogEntry[];
  handleSyncNow: () => void;
  syncing: boolean;
  oauthConnected: boolean;
}

export function SyncHistorySection({
  syncLogs, handleSyncNow, syncing, oauthConnected,
}: SyncHistorySectionProps) {
  return (
    <Section
      icon={<Database size={16} />}
      iconBg="var(--bg-tertiary)"
      iconColor="var(--text-secondary)"
      label="Sync History"
      description="Recent sync operations and their results"
      badge={syncLogs.length > 0 ? (
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          fontSize: '10px', fontWeight: 600,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}>{syncLogs.length}</span>
      ) : undefined}
    >
      {syncLogs.length === 0 ? (
        <EmptyState
          icon={<Database size={24} />}
          title="No sync history yet"
          description="Run your first sync to see operation results and statistics here. Sync history helps you track provisioning activity and troubleshoot issues."
          action={
            oauthConnected ? (
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)', color: 'white',
                  border: 'none', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                Run First Sync
              </button>
            ) : undefined
          }
        />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Started</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Completed</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Duration</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Users</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                    <div>{formatRelativeTime(log.startedAt) || formatDateTime(log.startedAt)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatDateTime(log.startedAt)}</div>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                    {formatDateTime(log.completedAt)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                    {formatDuration(log.duration)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      fontSize: '11px', fontWeight: 600,
                      background: log.status === 'success' ? 'var(--success-bg)' : log.status === 'error' ? 'var(--danger-bg)' : 'var(--accent-subtle)',
                      color: log.status === 'success' ? 'var(--success)' : log.status === 'error' ? 'var(--danger)' : 'var(--accent)',
                      border: `1px solid ${log.status === 'success' ? 'var(--success-border)' : log.status === 'error' ? 'var(--danger-border)' : 'var(--accent-border)'}`,
                      textTransform: 'capitalize',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {log.status === 'success' && <CheckCircle size={10} />}
                      {log.status === 'error' && <XCircle size={10} />}
                      {log.status === 'in_progress' && <RefreshCw size={10} className="ds-spin" />}
                      {log.status === 'in_progress' ? 'In Progress' : log.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                    {log.stats ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }} title="Synced">{log.stats.synced}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }} title="Created">{log.stats.created}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--accent-mid)', fontWeight: 600 }} title="Updated">{log.stats.updated}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }} title="Deactivated">{log.stats.deactivated}</span>
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.error ? (
                      <span style={{ fontSize: '12px', color: 'var(--danger)' }} title={log.error}>{log.error}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
