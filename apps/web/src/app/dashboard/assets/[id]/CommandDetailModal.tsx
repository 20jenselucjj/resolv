'use client';

import { X, AlertTriangle, Clock } from 'lucide-react';
import { DISPLAY_FONT, BODY_FONT, COMMAND_TYPES } from '@/lib/asset-detail-types';
import type { AgentCommand } from '@/lib/asset-detail-types';
import { formatDateTime } from '@/components/asset-detail-utils';

interface CommandDetailModalProps {
  command: AgentCommand;
  onClose: () => void;
  agentStatus?: string;
}

export function CommandDetailModal({ command, onClose, agentStatus }: CommandDetailModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{COMMAND_TYPES.find(t => t.value === command.command_type)?.icon || '⚡'}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: DISPLAY_FONT }}>
                {COMMAND_TYPES.find(t => t.value === command.command_type)?.label || command.command_type}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Status</span>
            <span style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: command.status === 'completed' ? 'var(--success-bg)' : command.status === 'failed' ? 'var(--danger-bg)' : command.status === 'cancelled' ? 'var(--bg-tertiary)' : command.status === 'dispatched' ? 'var(--accent-subtle)' : 'var(--warning-bg)',
              color: command.status === 'completed' ? 'var(--success)' : command.status === 'failed' ? 'var(--danger)' : command.status === 'cancelled' ? 'var(--text-muted)' : command.status === 'dispatched' ? 'var(--accent)' : 'var(--warning)'
            }}>
              {command.status === 'completed' && command.exit_code === 0 ? 'Completed' : command.status.charAt(0).toUpperCase() + command.status.slice(1)}
            </span>
            {command.exit_code != null && (
              <span style={{ fontSize: 12, color: command.exit_code === 0 ? 'var(--success)' : 'var(--danger)' }}>
                Exit code: {command.exit_code}
              </span>
            )}
          </div>

          {/* Agent-offline warning for pending commands */}
          {command.status === 'pending' && agentStatus !== 'online' && (
            <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
                display: 'flex', alignItems: 'flex-start', gap: 10
              }}>
                <Clock size={16} color='var(--warning)' style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 2 }}>Agent Offline</div>
                  <div style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.5 }}>
                    This command won't run until the agent connects. Deploy the agent to this machine and it will pick up pending commands automatically.
                  </div>
                </div>
              </div>
          )}

          {/* Stale-dispatched warning — command was picked up by agent but never reported back */}
          {command.status === 'dispatched' && command.dispatched_at && (() => {
            const elapsed = Date.now() - new Date(command.dispatched_at).getTime();
            if (elapsed < 120000) return null;
            return (
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
                  display: 'flex', alignItems: 'flex-start', gap: 10
                }}>
                  <AlertTriangle size={16} color='var(--warning)' style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 2 }}>Command appears stuck</div>
                    <div style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.5 }}>
                      The agent picked up this command {Math.round(elapsed / 1000)}s ago but hasn't reported a result.
                      The agent process may have crashed or lost connectivity. You can force-cancel this command and retry.
                    </div>
                  </div>
                </div>
              );
          })()}

          {/* Timestamps */}
          {command.created_at && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Created</span>
                  <span style={{ color: 'var(--text)' }}>{formatDateTime(command.created_at)}</span>
                  {command.created_by_name && <span style={{ color: 'var(--text-muted)' }}>by {command.created_by_name}</span>}
                </div>
                {command.dispatched_at && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Dispatched</span>
                    <span style={{ color: 'var(--text)' }}>{formatDateTime(command.dispatched_at)}</span>
                  </div>
                )}
                {command.started_at && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Started</span>
                    <span style={{ color: 'var(--text)' }}>{formatDateTime(command.started_at)}</span>
                  </div>
                )}
                {command.completed_at && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Completed</span>
                    <span style={{ color: 'var(--text)' }}>{formatDateTime(command.completed_at)}</span>
                    {command.dispatched_at && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        (Duration: {Math.round((new Date(command.completed_at).getTime() - new Date(command.dispatched_at).getTime()) / 1000)}s)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {command.error_message && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--danger)', marginBottom: 6 }}>Error</div>
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {command.error_message}
              </div>
            </div>
          )}

          {/* Payload */}
          {command.payload && Object.keys(command.payload).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Payload</div>
              <pre style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', lineHeight: 1.5, color: 'var(--text)' }}>
                {(() => {
                  try {
                    const p = command.payload;
                    if (typeof p === 'object') {
                      if (command.command_type === 'run_script' && p.script) {
                        return `Script: ${p.script_type || 'powershell'}\n${'─'.repeat(40)}\n${p.script}`;
                      }
                      return JSON.stringify(p, null, 2);
                    }
                    return String(p);
                  } catch { return String(command.payload); }
                })()}
              </pre>
            </div>
          )}

          {/* Stdout */}
          {command.stdout && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Output (stdout)</div>
                <button onClick={() => { navigator.clipboard.writeText(command.stdout || ''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}>
                  Copy
                </button>
              </div>
              <pre style={{ padding: 12, borderRadius: 'var(--radius-md)', background: command.status === 'failed' ? 'var(--danger-bg)' : 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', lineHeight: 1.5, color: 'var(--text)' }}>
                {command.stdout}
              </pre>
            </div>
          )}

          {/* Stderr */}
          {command.stderr && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--danger)' }}>Error Output (stderr)</div>
                <button onClick={() => { navigator.clipboard.writeText(command.stderr || ''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}>
                  Copy
                </button>
              </div>
              <pre style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', lineHeight: 1.5, color: 'var(--danger)' }}>
                {command.stderr}
              </pre>
            </div>
          )}

          {/* Config info */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Priority: </span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{command.priority}</span>
            </div>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Timeout: </span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{command.timeout_seconds}s</span>
            </div>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Max retries: </span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{command.max_retries}</span>
            </div>
            {command.expires_at && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Expires: </span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatDateTime(command.expires_at)}</span>
              </div>
            )}
            {command.retry_count > 0 && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Retries: </span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{command.retry_count}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
