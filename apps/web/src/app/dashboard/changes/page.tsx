'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Search, Plus, AlertCircle, ChevronDown, X, Calendar } from 'lucide-react';
import { toast } from '@/components/Toast';
import { SkeletonPage } from '@/components/Skeleton';
import { PRIORITY_OPTIONS } from '@/lib/constants';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'rolled_back', label: 'Rolled Back' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'standard', label: 'Standard' },
  { value: 'normal', label: 'Normal' },
  { value: 'emergency', label: 'Emergency' },
];

const RISK_OPTIONS = [
  { value: 'all', label: 'All Risk' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#2563eb',
  high: '#f59e0b',
  critical: '#dc2626',
};

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
  scheduled_start: string | null;
  scheduled_end: string | null;
  category_name: string | null;
  category_color: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_to_avatar: string | null;
  requested_by_name: string;
  created_at: string;
}

export default function ChangesPage() {
  const router = useRouter();
  const { user } = useStore();
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showNewPanel, setShowNewPanel] = useState(false);
  const pageSize = 25;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // New change form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('standard');
  const [newPriority, setNewPriority] = useState('medium');
  const [newRisk, setNewRisk] = useState('medium');
  const [newImplPlan, setNewImplPlan] = useState('');
  const [newRollbackPlan, setNewRollbackPlan] = useState('');
  const [newScheduledStart, setNewScheduledStart] = useState('');
  const [newScheduledEnd, setNewScheduledEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [newCiIds, setNewCiIds] = useState<string[]>([]);
  const [ciSearchQuery, setCiSearchQuery] = useState('');
  const [ciSearchResults, setCiSearchResults] = useState<{ id: string; name: string; ci_type: string }[]>([]);
  const [showCiPicker, setShowCiPicker] = useState(false);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('change_type', typeFilter);
    if (riskFilter !== 'all') params.set('risk_level', riskFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (search) params.set('search', search);

    try {
      const res = await api.get<{ data: Change[]; total: number }>(`/changes?${params}`);
      setChanges(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load changes');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, riskFilter, priorityFilter, search]);

  useEffect(() => {
    if (isAdminOrAgent) fetchChanges();
  }, [fetchChanges, isAdminOrAgent]);

  const searchCis = async (q: string) => {
    if (q.length < 2) { setCiSearchResults([]); return; }
    try {
      const res = await api.get<{ data: any[] }>(`/cmdb?search=${encodeURIComponent(q)}&pageSize=10`);
      setCiSearchResults(res.data);
    } catch { setCiSearchResults([]); }
  };

  useEffect(() => {
    if (!ciSearchQuery || ciSearchQuery.length < 2) { setCiSearchResults([]); return; }
    const timer = setTimeout(() => searchCis(ciSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [ciSearchQuery]);

  const handleCreate = async () => {
    const errors: Record<string, string> = {};
    if (!newTitle.trim()) errors.title = 'Title is required';
    if (!newType) errors.change_type = 'Change type is required';
    if (!newPriority) errors.priority = 'Priority is required';
    if (!newDesc.trim()) errors.description = 'Description is required';
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await api.post('/changes', {
        title: newTitle.trim(),
        description: newDesc,
        change_type: newType,
        priority: newPriority,
        risk_level: newRisk,
        implementation_plan: newImplPlan || null,
        rollback_plan: newRollbackPlan || null,
        scheduled_start: newScheduledStart || null,
        scheduled_end: newScheduledEnd || null,
        ci_ids: newCiIds,
      });
      setNewTitle('');
      setNewDesc('');
      setNewType('standard');
      setNewPriority('medium');
      setNewRisk('medium');
      setNewImplPlan('');
      setNewRollbackPlan('');
      setNewScheduledStart('');
      setNewScheduledEnd('');
      setNewCiIds([]);
      setShowNewPanel(false);
      setValidationErrors({});
      fetchChanges();
    } catch (err) {
      toast.error('Failed to create change', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (!isAdminOrAgent) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertCircle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Access Denied</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Change management is internal and only available to agents and admins.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Changes</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            ITIL change management with approval workflows and risk assessment
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/dashboard/changes/calendar')} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
            <Calendar size={14} /> Calendar
          </button>
          <button onClick={() => setShowNewPanel(true)} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> New Change
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            placeholder="Search changes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input"
            style={{ paddingLeft: 32, height: 32, fontSize: 12, width: '100%', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', height: 32, fontSize: 11, fontWeight: 500, borderRadius: 8, border: `1px solid ${statusFilter !== 'all' ? 'var(--accent-border)' : 'var(--border-subtle)'}`, background: statusFilter !== 'all' ? 'var(--accent-subtle)' : 'var(--bg)', color: statusFilter !== 'all' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Status {statusFilter !== 'all' && <span style={{ color: 'var(--text)', marginLeft: 2 }}>{STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}</span>}
            <ChevronDown size={10} />
          </button>
          {openDropdown === 'status' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 160, padding: 4 }}>
              {STATUS_OPTIONS.map(opt => (
                <div key={opt.value} onClick={() => { setStatusFilter(opt.value); setPage(1); setOpenDropdown(null); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(opt.value); setPage(1); setOpenDropdown(null); } }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: opt.value === statusFilter ? 'var(--accent)' : 'var(--text)', background: opt.value === statusFilter ? 'var(--accent-subtle)' : 'transparent', fontWeight: opt.value === statusFilter ? 600 : 400 }}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Type filter */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', height: 32, fontSize: 11, fontWeight: 500, borderRadius: 8, border: `1px solid ${typeFilter !== 'all' ? 'var(--accent-border)' : 'var(--border-subtle)'}`, background: typeFilter !== 'all' ? 'var(--accent-subtle)' : 'var(--bg)', color: typeFilter !== 'all' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Type {typeFilter !== 'all' && <span style={{ color: 'var(--text)', marginLeft: 2 }}>{TYPE_OPTIONS.find(o => o.value === typeFilter)?.label}</span>}
            <ChevronDown size={10} />
          </button>
          {openDropdown === 'type' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 160, padding: 4 }}>
              {TYPE_OPTIONS.map(opt => (
                <div key={opt.value} onClick={() => { setTypeFilter(opt.value); setPage(1); setOpenDropdown(null); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTypeFilter(opt.value); setPage(1); setOpenDropdown(null); } }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: opt.value === typeFilter ? 'var(--accent)' : 'var(--text)', background: opt.value === typeFilter ? 'var(--accent-subtle)' : 'transparent', fontWeight: opt.value === typeFilter ? 600 : 400 }}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk filter */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenDropdown(openDropdown === 'risk' ? null : 'risk')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', height: 32, fontSize: 11, fontWeight: 500, borderRadius: 8, border: `1px solid ${riskFilter !== 'all' ? 'var(--accent-border)' : 'var(--border-subtle)'}`, background: riskFilter !== 'all' ? 'var(--accent-subtle)' : 'var(--bg)', color: riskFilter !== 'all' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Risk {riskFilter !== 'all' && <span style={{ color: 'var(--text)', marginLeft: 2 }}>{RISK_OPTIONS.find(o => o.value === riskFilter)?.label}</span>}
            <ChevronDown size={10} />
          </button>
          {openDropdown === 'risk' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 160, padding: 4 }}>
              {RISK_OPTIONS.map(opt => (
                <div key={opt.value} onClick={() => { setRiskFilter(opt.value); setPage(1); setOpenDropdown(null); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRiskFilter(opt.value); setPage(1); setOpenDropdown(null); } }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: opt.value === riskFilter ? 'var(--accent)' : 'var(--text)', background: opt.value === riskFilter ? 'var(--accent-subtle)' : 'transparent', fontWeight: opt.value === riskFilter ? 600 : 400 }}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority filter */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', height: 32, fontSize: 11, fontWeight: 500, borderRadius: 8, border: `1px solid ${priorityFilter !== 'all' ? 'var(--accent-border)' : 'var(--border-subtle)'}`, background: priorityFilter !== 'all' ? 'var(--accent-subtle)' : 'var(--bg)', color: priorityFilter !== 'all' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Priority {priorityFilter !== 'all' && <span style={{ color: 'var(--text)', marginLeft: 2 }}>{PRIORITY_OPTIONS.find(o => o.value === priorityFilter)?.label}</span>}
            <ChevronDown size={10} />
          </button>
          {openDropdown === 'priority' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 160, padding: 4 }}>
              {PRIORITY_OPTIONS.map(opt => (
                <div key={opt.value} onClick={() => { setPriorityFilter(opt.value); setPage(1); setOpenDropdown(null); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPriorityFilter(opt.value); setPage(1); setOpenDropdown(null); } }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: opt.value === priorityFilter ? 'var(--accent)' : 'var(--text)', background: opt.value === priorityFilter ? 'var(--accent-subtle)' : 'transparent', fontWeight: opt.value === priorityFilter ? 600 : 400 }}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 16px', margin: '16px 24px 0', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18 }}>×</button>
          </div>
        )}
        {loading ? (
          <SkeletonPage />
        ) : changes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }}>📋</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>No changes found</h3>
            <p style={{ fontSize: 14 }}>Create a new change request to start the process.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>#</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Risk</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Priority</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Scheduled</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, idx) => (
                <tr key={c.id} onClick={() => router.push(`/dashboard/changes/${c.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', animation: `popIn 0.2s ease-out ${idx * 0.03}s both` }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>#{c.number}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${TYPE_COLORS[c.change_type]}15`, color: TYPE_COLORS[c.change_type] }}>
                      {c.change_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${PRIORITY_COLORS[c.risk_level] || '#6b7280'}15`, color: PRIORITY_COLORS[c.risk_level] || '#6b7280' }}>
                      {c.risk_level}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${STATUS_COLORS[c.status]}15`, color: STATUS_COLORS[c.status] }}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${PRIORITY_COLORS[c.priority]}15`, color: PRIORITY_COLORS[c.priority] }}>
                      {c.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.scheduled_start ? new Date(c.scheduled_start).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {c.assigned_to_name || 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {page} of {totalPages} ({total} total)</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn-ghost btn-sm">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn btn-ghost btn-sm">Next</button>
          </div>
        </div>
      )}

      {/* New Change Panel */}
      {showNewPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 520, maxWidth: 600, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>New Change Request</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflow: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Title *</label>
                <input value={newTitle} onChange={e => { setNewTitle(e.target.value); if (validationErrors.title) setValidationErrors(prev => ({ ...prev, title: '' })); }} className="input" placeholder="Brief title describing the change" style={{ width: '100%' }} autoFocus />
                {validationErrors.title && <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2, display: 'block' }}>{validationErrors.title}</span>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
                <textarea value={newDesc} onChange={e => { setNewDesc(e.target.value); if (validationErrors.description) setValidationErrors(prev => ({ ...prev, description: '' })); }} className="textarea" placeholder="Detailed description of the change" rows={3} style={{ width: '100%', resize: 'vertical' }} />
                {validationErrors.description && <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2, display: 'block' }}>{validationErrors.description}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Change Type</label>
                  <select value={newType} onChange={e => { setNewType(e.target.value); if (validationErrors.change_type) setValidationErrors(prev => ({ ...prev, change_type: '' })); }} className="select" style={{ width: '100%' }}>
                    <option value="standard">Standard (Pre-approved)</option>
                    <option value="normal">Normal (CAB Approval)</option>
                    <option value="emergency">Emergency (Direct Admin)</option>
                  </select>
                  {validationErrors.change_type && <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2, display: 'block' }}>{validationErrors.change_type}</span>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Priority</label>
                  <select value={newPriority} onChange={e => { setNewPriority(e.target.value); if (validationErrors.priority) setValidationErrors(prev => ({ ...prev, priority: '' })); }} className="select" style={{ width: '100%' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  {validationErrors.priority && <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2, display: 'block' }}>{validationErrors.priority}</span>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Risk Level</label>
                  <select value={newRisk} onChange={e => setNewRisk(e.target.value)} className="select" style={{ width: '100%' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Scheduled Start</label>
                  <input type="datetime-local" value={newScheduledStart} onChange={e => setNewScheduledStart(e.target.value)} className="input" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Implementation Plan</label>
                <textarea value={newImplPlan} onChange={e => setNewImplPlan(e.target.value)} className="textarea" placeholder="Steps to implement this change" rows={2} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Rollback Plan</label>
                <textarea value={newRollbackPlan} onChange={e => setNewRollbackPlan(e.target.value)} className="textarea" placeholder="Steps to rollback if needed" rows={2} style={{ width: '100%', resize: 'vertical' }} />
              </div>
            </div>
            {/* Linked CIs */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Linked Configuration Items</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {newCiIds.map(ciId => (
                  <span key={ciId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: 12, border: '1px solid var(--border)' }}>
                    {ciId.slice(0, 8)}...
                    <button onClick={() => setNewCiIds(prev => prev.filter(id => id !== ciId))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, color: 'var(--text-secondary)' }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  value={ciSearchQuery}
                  onChange={e => { setCiSearchQuery(e.target.value); setShowCiPicker(true); }}
                  onFocus={() => setShowCiPicker(true)}
                  placeholder="Search CIs to link..."
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                />
                {showCiPicker && ciSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 10, maxHeight: 180, overflow: 'auto' }}>
                    {ciSearchResults.map(ci => (
                      <button
                        key={ci.id}
                        onClick={() => {
                          if (!newCiIds.includes(ci.id)) setNewCiIds(prev => [...prev, ci.id]);
                          setCiSearchQuery('');
                          setCiSearchResults([]);
                          setShowCiPicker(false);
                        }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
                      >
                        {ci.name} <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>({ci.ci_type})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowNewPanel(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={submitting || !newTitle.trim()} className="btn btn-primary">{submitting ? 'Creating...' : 'Create Change'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
