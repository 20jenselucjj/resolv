'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import {
  CheckCircle, XCircle, Clock, ArrowRight,
  ShieldCheck, ShieldX, AlertCircle, Search,
  ChevronDown, ChevronUp, History, AlertTriangle,
} from 'lucide-react';

interface PendingApproval {
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
  // From join with approval_requests
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  request_status: string;
  priority: string;
  due_date?: string | null;
  request_created_at: string;
  requested_by: string;
  requested_by_name: string;
}

interface ApprovalDetail {
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
  steps: any[];
  history: any[];
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

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#2563eb',
  high: '#f59e0b',
  critical: '#dc2626',
};

const ENTITY_LABELS: Record<string, string> = {
  ticket: 'Ticket',
  change: 'Change Request',
  service_request: 'Service Request',
  asset: 'Asset',
};

function ApprovalDetailView({ approval, onClose, onAction }: {
  approval: ApprovalDetail;
  onClose: () => void;
  onAction: () => void;
}) {
  const { user } = useStore();
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const canAct = approval.status === 'pending' && approval.steps?.some((s: any) => {
    if (s.status !== 'pending') return false;
    if (user?.role === 'admin') return true;
    if (s.approver_id === user?.id) return true;
    if (s.approver_role && s.approver_role === user?.role) return true;
    return false;
  });

  const handleApprove = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/approvals/${approval.id}/approve`, { comment: comment || undefined });
      onAction();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!comment.trim()) {
      setError('Comment required for denial');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/approvals/${approval.id}/deny`, { comment });
      onAction();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/approvals/${approval.id}/cancel`, {});
      onAction();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeUp 0.2s ease-out',
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24,
        width: '90%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: `${STATUS_COLORS[approval.status]}18`,
              color: STATUS_COLORS[approval.status],
            }}>
              {STATUS_LABELS[approval.status] || approval.status}
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {approval.title}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, padding: 4,
          }}>×</button>
        </div>

        {/* Info */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>Entity: <strong>{ENTITY_LABELS[approval.entity_type] || approval.entity_type}</strong></span>
          <span>Requested by: <strong>{approval.requested_by_name}</strong></span>
          <span>Priority: <strong style={{ color: PRIORITY_COLORS[approval.priority] || '#6b7280' }}>{approval.priority}</strong></span>
          {approval.due_date && (
            <span>Due: <strong>{new Date(approval.due_date).toLocaleDateString()}</strong></span>
          )}
        </div>

        {approval.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
            {approval.description}
          </div>
        )}

        {/* Steps */}
        {approval.steps && approval.steps.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Steps
            </div>
            {approval.steps.map((step: any, idx: number) => (
              <div key={step.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: step.status === 'pending' ? 'var(--bg-secondary)' : 'transparent',
                marginBottom: 4,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.status === 'approved' ? '#05966920' :
                              step.status === 'denied' ? '#dc262620' :
                              step.status === 'pending' ? '#f59e0b20' : 'var(--bg-tertiary)',
                  border: `2px solid ${
                    step.status === 'approved' ? '#059669' :
                    step.status === 'denied' ? '#dc2626' :
                    step.status === 'pending' ? '#f59e0b' : 'var(--border)'
                  }`,
                  flexShrink: 0,
                }}>
                  {step.status === 'approved' ? <CheckCircle size={13} color="#059669" /> :
                   step.status === 'denied' ? <XCircle size={13} color="#dc2626" /> :
                   <Clock size={13} color={step.status === 'pending' ? '#f59e0b' : 'var(--text-muted)'} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {step.approver_name || step.approver_role || 'Any Approver'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Step {step.step_index + 1} — {STATUS_LABELS[step.status] || step.status}
                    {step.decided_at && ` — ${new Date(step.decided_at).toLocaleDateString()}`}
                  </div>
                  {step.comment && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      "{step.comment}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action area */}
        {canAct && (
          <div style={{ marginBottom: 16 }}>
            <input
              placeholder="Add a comment (required for denial)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg)', color: 'var(--text)', marginBottom: 8, outline: 'none',
              }}
            />
            {error && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleApprove} disabled={actionLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', fontSize: 12, fontWeight: 600,
                  background: '#059669', color: 'white', border: 'none',
                  borderRadius: 'var(--radius-md)', cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button onClick={handleDeny} disabled={actionLoading || !comment.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', fontSize: 12, fontWeight: 600,
                  background: '#dc2626', color: 'white', border: 'none',
                  borderRadius: 'var(--radius-md)', cursor: actionLoading || !comment.trim() ? 'not-allowed' : 'pointer',
                  opacity: actionLoading || !comment.trim() ? 0.6 : 1,
                }}
              >
                <XCircle size={14} /> Deny
              </button>
              {(user?.role === 'admin' || approval.requested_by === user?.id) && approval.status === 'pending' && (
                <button onClick={handleCancel} disabled={actionLoading}
                  style={{
                    marginLeft: 'auto', padding: '7px 16px', fontSize: 12, fontWeight: 500,
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel Request
                </button>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {approval.history && approval.history.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <History size={12} /> History
            </div>
            {approval.history.map((entry: any) => (
              <div key={entry.id} style={{
                display: 'flex', gap: 8, padding: '4px 0', fontSize: 11,
                color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{
                  fontWeight: 600,
                  color: entry.action === 'approved' ? '#059669' :
                         entry.action === 'denied' ? '#dc2626' :
                         entry.action === 'cancelled' ? '#6b7280' : 'var(--accent)',
                  textTransform: 'capitalize',
                }}>{entry.action}</span>
                <span>by {entry.actor_name || 'System'}</span>
                {entry.comment && <span style={{ color: 'var(--text-muted)' }}>— {entry.comment}</span>}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { user } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [allApprovals, setAllApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [detailApproval, setDetailApproval] = useState<ApprovalDetail | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get<{ data: PendingApproval[] }>('/approvals/my-pending');
      setPendingApprovals(res.data);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load pending approvals');
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('entity_type', search);
      const res = await api.get<{ data: any[]; total: number }>(`/approvals?${params}`);
      setAllApprovals(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load approvals');
    }
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    if (tab === 'pending') {
      fetchPending().finally(() => setLoading(false));
    } else {
      fetchAll().finally(() => setLoading(false));
    }
  }, [tab, fetchPending, fetchAll]);

  // Listen for real-time socket updates
  useEffect(() => {
    const { connectSocket } = require('@/lib/socket');
    const socket = connectSocket();
    const handler = () => {
      if (tab === 'pending') fetchPending();
      else fetchAll();
    };
    socket.on('approval:updated', handler);
    socket.on('approval:created', handler);
    return () => {
      socket.off('approval:updated', handler);
      socket.off('approval:created', handler);
    };
  }, [tab, fetchPending, fetchAll]);

  const openDetail = async (requestId: string) => {
    try {
      const res = await api.get<{ data: ApprovalDetail }>(`/approvals/${requestId}`);
      setDetailApproval(res.data);
    } catch (err) {
      console.error('Failed to load approval detail', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Approvals</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Review and manage approval requests
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          {(['pending', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              style={{
                padding: '8px 18px', fontSize: 12, fontWeight: 600,
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {t === 'pending' ? <Clock size={13} /> : <ShieldCheck size={13} />}
              {t === 'pending' ? 'Pending' : 'All'}
              {t === 'pending' && pendingApprovals.length > 0 && (
                <span style={{
                  background: '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 8, lineHeight: '16px',
                }}>
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search (All tab) */}
        {tab === 'all' && (
          <div style={{ position: 'relative', maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              placeholder="Search by entity type..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                paddingLeft: 32, height: 34, fontSize: 12, width: '100%',
                background: 'var(--bg)', borderRadius: 8,
                border: '1px solid var(--border-subtle)', color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {fetchError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{fetchError}</span>
            <button onClick={() => setFetchError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : tab === 'pending' ? (
          <>
            {pendingApprovals.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 40, color: 'var(--text-muted)',
                fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <CheckCircle size={32} color="var(--text-muted)" opacity={0.4} />
                <span>No pending approvals</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingApprovals.map(item => (
                  <div
                    key={item.id}
                    onClick={() => openDetail(item.request_id)}
                    style={{
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', padding: '14px 18px',
                      cursor: 'pointer', transition: 'all 0.15s',
                      animation: 'fadeUp 0.3s ease-out',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: `${PRIORITY_COLORS[item.priority]}18`,
                            color: PRIORITY_COLORS[item.priority] || '#6b7280',
                            textTransform: 'uppercase',
                          }}>
                            {item.priority}
                          </span>
                          <span style={{
                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          }}>
                            {ENTITY_LABELS[item.entity_type] || item.entity_type}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          Requested by <strong>{item.requested_by_name}</strong>
                          {item.due_date && (
                            <> • Due <strong>{new Date(item.due_date).toLocaleDateString()}</strong></>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: '#f59e0b20', color: '#f59e0b',
                          whiteSpace: 'nowrap',
                        }}>
                          Step {item.step_index + 1}
                        </span>
                        <ArrowRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {allApprovals.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 40, color: 'var(--text-muted)',
                fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <ShieldCheck size={32} color="var(--text-muted)" opacity={0.4} />
                <span>No approval requests found</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allApprovals.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => openDetail(item.id)}
                    style={{
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', padding: '12px 18px',
                      cursor: 'pointer', transition: 'all 0.15s',
                      animation: 'fadeUp 0.3s ease-out',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: `${STATUS_COLORS[item.status]}18`,
                            color: STATUS_COLORS[item.status],
                          }}>
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                          <span style={{
                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: `${PRIORITY_COLORS[item.priority]}18`,
                            color: PRIORITY_COLORS[item.priority],
                          }}>
                            {item.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {item.requested_by_name} — {ENTITY_LABELS[item.entity_type] || item.entity_type}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 500,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.5 : 1, color: 'var(--text)',
                  }}
                >
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 500,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', cursor: page >= Math.ceil(total / pageSize) ? 'not-allowed' : 'pointer',
                    opacity: page >= Math.ceil(total / pageSize) ? 0.5 : 1, color: 'var(--text)',
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {detailApproval && (
        <ApprovalDetailView
          approval={detailApproval}
          onClose={() => setDetailApproval(null)}
          onAction={() => {
            if (tab === 'pending') fetchPending();
            else fetchAll();
          }}
        />
      )}
    </div>
  );
}
