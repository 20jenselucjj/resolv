'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import {
  CheckCircle, XCircle, Clock, ArrowRight,
  ShieldCheck, ShieldX, AlertCircle, ChevronDown, ChevronUp,
  Send, History,
} from 'lucide-react';
import { toast } from '@/components/Toast';

interface ApprovalRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_email: string;
  steps: ApprovalStep[];
  history: ApprovalHistoryEntry[];
}

interface ApprovalStep {
  id: string;
  request_id: string;
  step_index: number;
  approver_id?: string | null;
  approver_role?: string | null;
  status: string;
  comment?: string | null;
  decided_at?: string | null;
  created_at: string;
  approver_name?: string | null;
  approver_email?: string | null;
  approver_avatar?: string | null;
}

interface ApprovalHistoryEntry {
  id: string;
  request_id: string;
  step_id?: string | null;
  actor_id?: string | null;
  action: string;
  comment?: string | null;
  created_at: string;
  actor_name?: string | null;
}

interface ApprovalPanelProps {
  entityType: string;
  entityId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#059669',
  denied: '#dc2626',
  cancelled: '#6b7280',
  escalated: '#7c3aed',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
  escalated: 'Escalated',
};

const STEP_STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle,
  denied: XCircle,
  skipped: ShieldX,
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#059669',
  denied: '#dc2626',
  skipped: '#6b7280',
};

export function ApprovalPanel({ entityType, entityId }: ApprovalPanelProps) {
  const { user } = useStore();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await api.get<{ data: ApprovalRequest[] }>(
        `/approvals?entity_type=${encodeURIComponent(entityType)}&entity_id=${entityId}&pageSize=10`
      );
      setApprovals(res.data);
    } catch (err: any) {
      toast.error('Failed to fetch approvals', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Listen for real-time updates
  useEffect(() => {
    const { connectSocket } = require('@/lib/socket');
    const socket = connectSocket();
    const handler = () => fetchApprovals();
    socket.on('approval:updated', handler);
    socket.on('approval:created', handler);
    return () => {
      socket.off('approval:updated', handler);
      socket.off('approval:created', handler);
    };
  }, [fetchApprovals]);

  const canActOnStep = (step: ApprovalStep, request: ApprovalRequest): boolean => {
    if (request.status !== 'pending') return false;
    if (step.status !== 'pending') return false;
    if (user?.role === 'admin') return true;
    if (step.approver_id === user?.id) return true;
    if (step.approver_role && step.approver_role === user?.role) return true;
    return false;
  };

  const handleApprove = async (approvalId: string) => {
    setActionLoading(approvalId);
    setError('');
    try {
      await api.post(`/approvals/${approvalId}/approve`, { comment: comment || undefined });
      setComment('');
      await fetchApprovals();
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (approvalId: string) => {
    if (!comment.trim()) {
      setError('A comment is required to deny');
      return;
    }
    setActionLoading(approvalId);
    setError('');
    try {
      await api.post(`/approvals/${approvalId}/deny`, { comment });
      setComment('');
      await fetchApprovals();
    } catch (err: any) {
      setError(err.message || 'Failed to deny');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (approvalId: string) => {
    setActionLoading(approvalId);
    setError('');
    try {
      await api.post(`/approvals/${approvalId}/cancel`, {});
      await fetchApprovals();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        animation: 'fadeUp 0.3s ease-out',
      }}>
        <div style={{ height: 20, width: '60%', background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 16 }} />
        <div style={{ height: 12, width: '100%', background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: '80%', background: 'var(--bg-tertiary)', borderRadius: 6 }} />
      </div>
    );
  }

  if (approvals.length === 0) {
    return null; // Don't render anything if there are no approvals
  }

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      animation: 'fadeUp 0.3s ease-out',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-secondary)',
      }}>
        <ShieldCheck size={16} color="var(--accent)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          Approvals ({approvals.length})
        </span>
      </div>

      {approvals.map(approval => (
        <div key={approval.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {/* Header row */}
          <div style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: `${STATUS_COLORS[approval.status]}18`,
                  color: STATUS_COLORS[approval.status],
                  whiteSpace: 'nowrap',
                }}>
                  {STATUS_LABELS[approval.status] || approval.status}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {approval.title}
                </span>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0,
                }}
              >
                {expandedId === approval.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Requested by <strong>{approval.requested_by_name}</strong></span>
              {approval.due_date && (
                <span>Due: {new Date(approval.due_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Expanded detail */}
          {expandedId === approval.id && (
            <div style={{ padding: '0 18px 16px' }}>
              {/* Step chain */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Approval Chain
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                  {approval.steps.map((step, idx) => {
                    const StepIcon = STEP_STATUS_ICONS[step.status] || Clock;
                    const isLast = idx === approval.steps.length - 1;
                    const isCurrent = step.status === 'pending';

                    return (
                      <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          position: 'relative', flex: 1,
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isCurrent ? `${STEP_STATUS_COLORS[step.status]}20` :
                                         step.status === 'approved' ? '#05966920' :
                                         step.status === 'denied' ? '#dc262620' :
                                         'var(--bg-tertiary)',
                            border: `2px solid ${isCurrent ? STEP_STATUS_COLORS[step.status] :
                                       step.status === 'approved' ? '#059669' :
                                       step.status === 'denied' ? '#dc2626' :
                                       'var(--border)'}`,
                            flexShrink: 0,
                          }}>
                            <StepIcon size={14} color={
                              isCurrent ? STEP_STATUS_COLORS[step.status] :
                              step.status === 'approved' ? '#059669' :
                              step.status === 'denied' ? '#dc2626' :
                              'var(--text-muted)'
                            } />
                          </div>
                          <div style={{
                            fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)',
                            textAlign: 'center', marginTop: 4, maxWidth: 80,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {step.approver_name || step.approver_role || 'Any Approver'}
                          </div>
                          <div style={{
                            fontSize: 8, color: 'var(--text-muted)', textAlign: 'center',
                          }}>
                            {step.status === 'approved' && step.decided_at
                              ? new Date(step.decided_at).toLocaleDateString()
                              : STATUS_LABELS[step.status] || step.status}
                          </div>
                        </div>
                        {!isLast && (
                          <div style={{
                            flex: 1, height: 2,
                            background: step.status === 'approved' ? '#059669' : 'var(--border)',
                            margin: '0 4px', marginTop: -16, minWidth: 16,
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Approve/Deny actions */}
              {approval.status === 'pending' && approval.steps.some(s => canActOnStep(s, approval)) && (
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                    Your Approval Required
                  </div>
                  <input
                    placeholder="Add a comment (required for denial)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{
                      width: '100%', padding: '7px 10px', fontSize: 12,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg)', color: 'var(--text)',
                      marginBottom: 8, outline: 'none',
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  {error && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>{error}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleApprove(approval.id)}
                      disabled={actionLoading === approval.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        background: '#059669', color: 'white',
                        border: 'none', borderRadius: 'var(--radius-md)',
                        cursor: actionLoading === approval.id ? 'not-allowed' : 'pointer',
                        opacity: actionLoading === approval.id ? 0.6 : 1,
                      }}
                    >
                      <CheckCircle size={13} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(approval.id)}
                      disabled={actionLoading === approval.id || !comment.trim()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        background: '#dc2626', color: 'white',
                        border: 'none', borderRadius: 'var(--radius-md)',
                        cursor: actionLoading === approval.id || !comment.trim() ? 'not-allowed' : 'pointer',
                        opacity: actionLoading === approval.id || !comment.trim() ? 0.6 : 1,
                      }}
                    >
                      <XCircle size={13} />
                      Deny
                    </button>
                    {(user?.role === 'admin' || approval.requested_by === user?.id) && approval.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(approval.id)}
                        disabled={actionLoading === approval.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', fontSize: 12, fontWeight: 500,
                          background: 'transparent', color: 'var(--text-muted)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                          cursor: actionLoading === approval.id ? 'not-allowed' : 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* History */}
              {approval.history.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <History size={12} /> History
                  </div>
                  {approval.history.map(entry => (
                    <div key={entry.id} style={{
                      display: 'flex', gap: 8, padding: '5px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 11, color: 'var(--text-secondary)',
                    }}>
                      <span style={{
                        fontWeight: 600, color: entry.action === 'approved' ? '#059669' :
                                        entry.action === 'denied' ? '#dc2626' :
                                        entry.action === 'cancelled' ? '#6b7280' : 'var(--accent)',
                        textTransform: 'capitalize',
                      }}>
                        {entry.action}
                      </span>
                      <span>by <strong>{entry.actor_name || 'System'}</strong></span>
                      {entry.comment && <span style={{ color: 'var(--text-muted)' }}>— {entry.comment}</span>}
                      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
