'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date-utils';
import {
  ArrowLeft, AlertTriangle, Check, X, Play, RotateCcw,
  Send, ChevronDown, Activity, User as UserIcon, AlertCircle
} from 'lucide-react';

const STATUS_OPTIONS = ['draft', 'submitted', 'under_review', 'approved', 'scheduled', 'in_progress', 'completed', 'rejected', 'rolled_back', 'cancelled'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  submitted: '#7c3aed',
  under_review: '#f59e0b',
  approved: '#059669',
  scheduled: '#2563eb',
  in_progress: '#f59e0b',
  completed: '#059669',
  rejected: '#dc2626',
  rolled_back: '#dc2626',
  cancelled: '#6b7280',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#2563eb',
  high: '#f59e0b',
  critical: '#dc2626',
};

const TYPE_COLORS: Record<string, string> = {
  standard: '#059669',
  normal: '#2563eb',
  emergency: '#dc2626',
};

interface Change {
  id: string;
  number: number;
  title: string;
  description: string;
  change_type: string;
  status: string;
  priority: string;
  risk_level: string;
  impact: string | null;
  risk_assessment: string | null;
  implementation_plan: string | null;
  rollback_plan: string | null;
  test_results: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_to_avatar: string | null;
  requested_by_id: string;
  requested_by_name: string;
  approval_id: string | null;
  approval_status: string | null;
  approval_title: string | null;
  ticket_id: string | null;
  assets_affected: string[];
  services_affected: string[];
  outage_required: boolean;
  outage_description: string | null;
  cab_notes: string | null;
  post_implementation_review: string | null;
  created_at: string;
  updated_at: string;
  activity: any[];
}

export default function ChangeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useStore();
  const [change, setChange] = useState<Change | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollbackInput, setShowRollbackInput] = useState(false);
  const [pirDraft, setPirDraft] = useState('');
  const [showPirInput, setShowPirInput] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkedCis, setLinkedCis] = useState<any[]>([]);
  const [ciSearchQuery, setCiSearchQuery] = useState('');
  const [ciSearchResults, setCiSearchResults] = useState<any[]>([]);
  const [showCiPicker, setShowCiPicker] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const fetchChange = async () => {
    try {
      const res = await api.get<{ data: Change }>(`/changes/${id}`);
      setChange(res.data);
    } catch (err) {
      console.error('Failed to load change', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCis = async () => {
    try {
      const res = await api.get<{ data: any[] }>(`/changes/${id}/ci-links`);
      setLinkedCis(res.data);
    } catch {}
  };

  const linkCi = async (ciId: string) => {
    try {
      await api.post(`/changes/${id}/ci-links`, { ci_id: ciId });
      await fetchCis();
    } catch {}
  };

  const unlinkCi = async (linkId: string) => {
    try {
      await api.delete(`/changes/${id}/ci-links/${linkId}`);
      await fetchCis();
    } catch {}
  };

  const searchCis = async (q: string) => {
    if (q.length < 2) { setCiSearchResults([]); return; }
    try {
      const res = await api.get<{ data: any[] }>(`/cmdb?search=${encodeURIComponent(q)}&pageSize=10`);
      setCiSearchResults(res.data);
    } catch { setCiSearchResults([]); }
  };

  useEffect(() => {
    if (isAdminOrAgent) fetchChange();
  }, [id, isAdminOrAgent]);

  useEffect(() => {
    if (id) fetchCis();
  }, [id]);

  useEffect(() => {
    if (!ciSearchQuery || ciSearchQuery.length < 2) { setCiSearchResults([]); return; }
    const timer = setTimeout(() => searchCis(ciSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [ciSearchQuery]);

  const updateField = async (field: string, value: any) => {
    try {
      const res = await api.patch<{ data: Change }>(`/changes/${id}`, { [field]: value });
      setChange(res.data);
    } catch (err) {
      console.error('Update failed', err);
    }
  };

  const handleAction = async (action: string, body?: any) => {
    setSubmitting(true);
    try {
      const res = await api.post<{ data: Change }>(`/changes/${id}/${action}`, body || {});
      setChange(res.data);
      setActionError(null);
      setShowRejectInput(false);
      setShowRollbackInput(false);
      setShowPirInput(false);
      setRejectReason('');
      setRollbackReason('');
      setPirDraft('');
    } catch (err: any) {
      setActionError(err.message || `Failed to ${action}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdminOrAgent) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Access Denied</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 24, width: 200 }} />
        <div className="skeleton" style={{ height: 36, width: '60%' }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (!change) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Change not found</div>
        <button onClick={() => router.push('/dashboard/changes')} className="btn btn-secondary" style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  // Determine available actions based on current status
  const canSubmit = change.status === 'draft';
  const canApprove = (change.status === 'submitted' || change.status === 'under_review') && isAdmin;
  const canReject = (change.status === 'submitted' || change.status === 'under_review') && isAdmin;
  const canStart = (change.status === 'approved' || change.status === 'scheduled') && isAdminOrAgent;
  const canComplete = change.status === 'in_progress' && isAdminOrAgent;
  const canRollback = change.status === 'in_progress' && isAdminOrAgent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Top Bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', flexShrink: 0 }}>
        <button onClick={() => router.push('/dashboard/changes')} className="btn btn-ghost btn-icon" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Change #{change.number}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{change.title}</h1>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {canSubmit && (
            <button onClick={() => handleAction('submit')} disabled={submitting} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
              <Send size={14} /> {submitting ? '...' : 'Submit'}
            </button>
          )}
          {canApprove && (
            <button onClick={() => handleAction('approve')} disabled={submitting} className="btn btn-success btn-sm" style={{ gap: 4, background: 'var(--success)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <Check size={14} /> {submitting ? '...' : 'Approve'}
            </button>
          )}
          {canReject && !showRejectInput && (
            <button onClick={() => setShowRejectInput(true)} disabled={submitting} className="btn btn-danger btn-sm" style={{ gap: 4, background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <X size={14} /> Reject
            </button>
          )}
          {canStart && (
            <button onClick={() => handleAction('start')} disabled={submitting} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
              <Play size={14} /> {submitting ? '...' : 'Start'}
            </button>
          )}
          {canComplete && !showPirInput && (
            <button onClick={() => setShowPirInput(true)} className="btn btn-success btn-sm" style={{ gap: 4, background: 'var(--success)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <Check size={14} /> Complete
            </button>
          )}
          {canRollback && !showRollbackInput && (
            <button onClick={() => setShowRollbackInput(true)} className="btn btn-danger btn-sm" style={{ gap: 4, background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <RotateCcw size={14} /> Rollback
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 16px', margin: '8px 24px 0', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Inline action inputs */}
      {showRejectInput && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="input"
            style={{ flex: 1, height: 32, fontSize: 12 }}
            autoFocus
          />
          <button onClick={() => handleAction('reject', { reason: rejectReason })} disabled={submitting || !rejectReason.trim()} className="btn btn-danger btn-sm" style={{ background: 'var(--danger)', color: 'white' }}>
            {submitting ? '...' : 'Confirm Reject'}
          </button>
          <button onClick={() => setShowRejectInput(false)} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      )}

      {showRollbackInput && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={rollbackReason}
            onChange={e => setRollbackReason(e.target.value)}
            placeholder="Reason for rollback..."
            className="input"
            style={{ flex: 1, height: 32, fontSize: 12 }}
            autoFocus
          />
          <button onClick={() => handleAction('rollback', { reason: rollbackReason })} disabled={submitting || !rollbackReason.trim()} className="btn btn-danger btn-sm" style={{ background: 'var(--danger)', color: 'white' }}>
            {submitting ? '...' : 'Confirm Rollback'}
          </button>
          <button onClick={() => setShowRollbackInput(false)} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      )}

      {showPirInput && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={pirDraft}
            onChange={e => setPirDraft(e.target.value)}
            placeholder="Post-implementation review notes..."
            className="textarea"
            rows={2}
            style={{ flex: 1, fontSize: 12, resize: 'vertical' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4, paddingTop: 2 }}>
            <button onClick={() => handleAction('complete', { post_implementation_review: pirDraft || null })} disabled={submitting} className="btn btn-success btn-sm" style={{ background: 'var(--success)', color: 'white' }}>
              {submitting ? '...' : 'Confirm Complete'}
            </button>
            <button onClick={() => setShowPirInput(false)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ flex: 1.5, padding: '24px 32px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Properties Card */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Properties</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: STATUS_COLORS[change.status] }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[change.status] }} />
                    {change.status.replace(/_/g, ' ')}
                    {isAdminOrAgent && <ChevronDown size={11} />}
                  </button>
                  {openDropdown === 'status' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, minWidth: 160, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                      {STATUS_OPTIONS.map(s => (
                        <div key={s} onClick={() => { updateField('status', s); setOpenDropdown(null); }}
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateField('status', s); setOpenDropdown(null); } }}
                          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: s === change.status ? 'var(--accent)' : 'var(--text)', background: s === change.status ? 'var(--accent-subtle)' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[s] }} /> {s.replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Change Type</label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${TYPE_COLORS[change.change_type]}15`, color: TYPE_COLORS[change.change_type] }}>
                  {change.change_type}
                </span>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Priority</label>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: PRIORITY_COLORS[change.priority] }}>
                    {change.priority}
                    <ChevronDown size={11} />
                  </button>
                  {openDropdown === 'priority' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, minWidth: 160, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                      {PRIORITY_OPTIONS.map(p => (
                        <div key={p} onClick={() => { updateField('priority', p); setOpenDropdown(null); }}
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateField('priority', p); setOpenDropdown(null); } }}
                          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: p === change.priority ? 'var(--accent)' : 'var(--text)', background: p === change.priority ? 'var(--accent-subtle)' : 'transparent', fontWeight: p === change.priority ? 600 : 400 }}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Risk Level</label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${PRIORITY_COLORS[change.risk_level]}15`, color: PRIORITY_COLORS[change.risk_level] }}>
                  {change.risk_level}
                </span>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Assigned To</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.assigned_to_name || 'Unassigned'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Category</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.category_name || 'None'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Scheduled Start</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.scheduled_start ? formatDateTime(change.scheduled_start) : 'Not scheduled'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Scheduled End</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.scheduled_end ? formatDateTime(change.scheduled_end) : 'Not scheduled'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Actual Start</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.actual_start ? formatDateTime(change.actual_start) : '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Actual End</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.actual_end ? formatDateTime(change.actual_end) : '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Requested By</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.requested_by_name}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Outage Required</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{change.outage_required ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>

          {/* Approval Status */}
          {change.approval_id && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Approval Status</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: change.approval_status === 'approved' ? '#05966915' : change.approval_status === 'denied' ? '#dc262615' : '#f59e0b15',
                  color: change.approval_status === 'approved' ? '#059669' : change.approval_status === 'denied' ? '#dc2626' : '#f59e0b' }}>
                  {change.approval_status || 'pending'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{change.approval_title}</span>
              </div>
            </div>
          )}

          {/* Linked Ticket */}
          {change.ticket_id && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Linked Implementation Ticket</h3>
              <button onClick={() => window.open(`/dashboard/tickets/${change.ticket_id}`, '_blank')} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                View Ticket <ArrowLeft size={12} style={{ transform: 'rotate(135deg)' }} />
              </button>
            </div>
          )}

          {/* Description */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Description</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {change.description || 'No description provided.'}
            </p>
          </div>

          {/* Risk Assessment */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Risk Assessment</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {change.risk_assessment || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No risk assessment documented.</span>}
            </p>
          </div>

          {/* Implementation Plan */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Implementation Plan</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {change.implementation_plan || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No implementation plan documented.</span>}
            </p>
          </div>

          {/* Rollback Plan */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Rollback Plan</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {change.rollback_plan || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No rollback plan documented.</span>}
            </p>
          </div>

          {/* Test Results */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Test Results</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {change.test_results || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No test results documented.</span>}
            </p>
          </div>

          {/* Post Implementation Review */}
          {change.post_implementation_review && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Post-Implementation Review</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {change.post_implementation_review}
              </p>
            </div>
          )}
        </div>

        {/* Right column - Activity Timeline */}
        <div style={{ flex: 1, borderLeft: '1px solid var(--border)', overflow: 'auto', background: 'var(--bg-secondary)' }}>
          {/* Assets/Services affected */}
          {change.assets_affected.length > 0 && (
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Affected Assets</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {change.assets_affected.map((a, i) => (
                  <span key={i} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    {a.substring(0, 8)}...
                  </span>
                ))}
              </div>
            </div>
          )}
          {change.services_affected.length > 0 && (
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Affected Services</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {change.services_affected.map((s, i) => (
                  <span key={i} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Linked CIs */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
              Linked Configuration Items
              {isAdminOrAgent && <span style={{ fontWeight: 400, marginLeft: 8, cursor: 'pointer', fontSize: 11, color: 'var(--accent)' }} onClick={() => setShowCiPicker(!showCiPicker)}>+ Add</span>}
            </h3>
            {showCiPicker && (
              <div style={{ marginBottom: 8, position: 'relative' }}>
                <input
                  value={ciSearchQuery}
                  onChange={e => setCiSearchQuery(e.target.value)}
                  placeholder="Search CIs..."
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                />
                {ciSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 10, maxHeight: 160, overflow: 'auto' }}>
                    {ciSearchResults.map(ci => (
                      <button
                        key={ci.id}
                        onClick={() => { linkCi(ci.id); setCiSearchQuery(''); setCiSearchResults([]); setShowCiPicker(false); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
                      >
                        {ci.name} <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>({ci.ci_type})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {linkedCis.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No configuration items linked.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {linkedCis.map(link => (
                  <span key={link.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    {link.ci_name}
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({link.ci_type})</span>
                    {isAdminOrAgent && (
                      <button onClick={() => unlinkCi(link.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, color: 'var(--text-secondary)', marginLeft: 2 }}>×</button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {change.outage_description && (
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Outage Description</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>{change.outage_description}</p>
            </div>
          )}

          {/* Activity Timeline */}
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Activity</h3>
            {(!change.activity || change.activity.length === 0) ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No activity recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {change.activity.map((act: any) => {
                  let IconComponent = Activity;
                  let iconColor = 'var(--text-muted)';
                  if (act.action === 'status_changed' || act.action === 'approved' || act.action === 'approved_by_cab') { IconComponent = AlertCircle; iconColor = 'var(--success)'; }
                  else if (act.action === 'rejected' || act.action === 'rolled_back') { IconComponent = X; iconColor = 'var(--danger)'; }
                  else if (act.action === 'submitted') { IconComponent = Send; iconColor = 'var(--info)'; }
                  else if (act.action === 'implementation_started') { IconComponent = Play; iconColor = 'var(--warning)'; }
                  else if (act.action === 'completed') { IconComponent = Check; iconColor = 'var(--success)'; }
                  else if (act.action === 'created') { IconComponent = Activity; iconColor = 'var(--text-muted)'; }

                  const actionLabel = act.action.replace(/_/g, ' ');
                  const oldVal = act.old_value || '';
                  const newVal = act.new_value || '';
                  let actionText = `${act.actor_name || 'System'} ${actionLabel}`;
                  if (oldVal && newVal) {
                    actionText = `${act.actor_name || 'System'} ${actionLabel}: ${oldVal.replace(/_/g, ' ')} → ${newVal.replace(/_/g, ' ')}`;
                  } else if (newVal) {
                    actionText = `${act.actor_name || 'System'} ${actionLabel}: ${newVal.replace(/_/g, ' ')}`;
                  }

                  return (
                    <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconComponent size={14} color={iconColor} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{actionText}</div>
                        {act.comment && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>"{act.comment}"</div>}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatDateTime(act.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
