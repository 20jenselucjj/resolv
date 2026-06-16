'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Search, Plus, AlertCircle, ChevronDown, X } from 'lucide-react';
import { PROBLEM_STATUS_OPTIONS, PRIORITY_OPTIONS, PROBLEM_STATUS_COLORS } from '@/lib/constants';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#2563eb',
  high: '#f59e0b',
  critical: '#dc2626',
};

interface Problem {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  root_cause: string | null;
  workaround: string | null;
  resolution: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_to_avatar: string | null;
  created_by_id: string;
  created_by_name: string;
  tags: string[];
  linked_incidents_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export default function ProblemsPage() {
  const router = useRouter();
  const { user } = useStore();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showNewPanel, setShowNewPanel] = useState(false);
  const pageSize = 25;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // New problem form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (search) params.set('search', search);

    try {
      const res = await api.get<{ data: Problem[]; total: number }>(`/problems?${params}`);
      setProblems(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, search]);

  useEffect(() => {
    if (isAdminOrAgent) fetchProblems();
  }, [fetchProblems, isAdminOrAgent]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/problems', {
        title: newTitle.trim(),
        description: newDesc,
        priority: newPriority,
      });
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setShowNewPanel(false);
      fetchProblems();
    } catch (err) {
      console.error('Failed to create problem', err);
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
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Problems are internal and only available to agents and admins.</p>
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Problems</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Root cause analysis and known error management
          </p>
        </div>
        <button onClick={() => setShowNewPanel(true)} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
          <Plus size={14} /> New Problem
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            placeholder="Search problems..."
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
            Status {statusFilter !== 'all' && <span style={{ color: 'var(--text)', marginLeft: 2 }}>{PROBLEM_STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}</span>}
            <ChevronDown size={10} />
          </button>
          {openDropdown === 'status' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 160, padding: 4 }}>
              {PROBLEM_STATUS_OPTIONS.map(opt => (
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
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : problems.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <AlertCircle size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>No problems found</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Create a new problem to start tracking root causes.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>#</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Priority</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Assigned To</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Incidents</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p, idx) => (
                <tr key={p.id} onClick={() => router.push(`/dashboard/problems/${p.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', animation: `popIn 0.2s ease-out ${idx * 0.03}s both` }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>#{p.number}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${PROBLEM_STATUS_COLORS[p.status]}15`, color: PROBLEM_STATUS_COLORS[p.status] }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${PRIORITY_COLORS[p.priority]}15`, color: PRIORITY_COLORS[p.priority] }}>
                      {p.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.assigned_to_name || 'Unassigned'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: p.linked_incidents_count > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {p.linked_incidents_count}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(p.created_at).toLocaleDateString()}
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

      {/* New Problem Panel */}
      {showNewPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 480, maxWidth: 560, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>New Problem</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Title *</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input" placeholder="Brief title describing the problem" style={{ width: '100%' }} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="textarea" placeholder="Detailed description of the problem" rows={4} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Priority</label>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="select" style={{ width: '100%' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowNewPanel(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={submitting || !newTitle.trim()} className="btn btn-primary">{submitting ? 'Creating...' : 'Create Problem'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
