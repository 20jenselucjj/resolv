'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from '@/components/Toast';
import {
  ArrowLeft, ExternalLink, Plus, X, Save, Edit2, Check,
  AlertTriangle, Trash2, Activity, Link2,
  User as UserIcon, ChevronDown
} from 'lucide-react';
import { PROBLEM_STATUS_COLORS } from '@/lib/constants';

const STATUS_OPTIONS = ['open', 'investigating', 'identified', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const LINK_TYPES = ['related', 'caused_by', 'contributing'];

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
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  linked_incidents: any[];
  activity: any[];
}

interface LinkedIncident {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  link_type: string;
  link_id: string;
  assigned_to_name: string | null;
  created_at: string;
}

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useStore();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingRootCause, setEditingRootCause] = useState(false);
  const [rootCauseDraft, setRootCauseDraft] = useState('');
  const [editingWorkaround, setEditingWorkaround] = useState(false);
  const [workaroundDraft, setWorkaroundDraft] = useState('');
  const [editingResolution, setEditingResolution] = useState(false);
  const [resolutionDraft, setResolutionDraft] = useState('');

  // Link incident state
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkIncidentId, setLinkIncidentId] = useState('');
  const [linkType, setLinkType] = useState('related');
  const [linkSearch, setLinkSearch] = useState('');
  const [ticketSearchResults, setTicketSearchResults] = useState<any[]>([]);
  const [searchingTickets, setSearchingTickets] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Open dropdown for status/priority
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const fetchProblem = async () => {
    try {
      const res = await api.get<{ data: Problem }>(`/problems/${id}`);
      setProblem(res.data);
      setRootCauseDraft(res.data.root_cause || '');
      setWorkaroundDraft(res.data.workaround || '');
      setResolutionDraft(res.data.resolution || '');
    } catch (err) {
      toast.error('Failed to load problem', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminOrAgent) fetchProblem();
  }, [id, isAdminOrAgent]);

  const updateField = async (field: string, value: any) => {
    try {
      const res = await api.patch<{ data: Problem }>(`/problems/${id}`, { [field]: value });
      setProblem(res.data);
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Please try again');
    }
  };

  const saveRootCause = async () => {
    await updateField('root_cause', rootCauseDraft);
    setEditingRootCause(false);
  };

  const saveWorkaround = async () => {
    await updateField('workaround', workaroundDraft);
    setEditingWorkaround(false);
  };

  const saveResolution = async () => {
    await updateField('resolution', resolutionDraft);
    setEditingResolution(false);
  };

  const handleLinkIncident = async () => {
    if (!linkIncidentId) return;
    setSubmitting(true);
    try {
      await api.post(`/problems/${id}/link-incident`, { incident_id: linkIncidentId, link_type: linkType });
      setShowLinkPanel(false);
      setLinkIncidentId('');
      setLinkSearch('');
      setLinkType('related');
      fetchProblem();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkIncident = async (incidentId: string) => {
    if (!confirm('Unlink this incident from the problem?')) return;
    try {
      await api.delete(`/problems/${id}/link-incident/${incidentId}`);
      fetchProblem();
    } catch (err) {
      toast.error('Failed to unlink incident', err instanceof Error ? err.message : 'Please try again');
    }
  };

  const searchTickets = async (q: string) => {
    setLinkSearch(q);
    if (!q.trim()) {
      setTicketSearchResults([]);
      return;
    }
    setSearchingTickets(true);
    try {
      const res = await api.get<{ data: any[] }>(`/tickets?search=${encodeURIComponent(q)}&pageSize=10`);
      setTicketSearchResults(res.data.filter((t: any) =>
        !problem?.linked_incidents?.find((li: LinkedIncident) => li.id === t.id)
      ));
    } catch {
      setTicketSearchResults([]);
    } finally {
      setSearchingTickets(false);
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

  if (!problem) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Problem not found</div>
        <button onClick={() => router.push('/dashboard/problems')} className="btn btn-secondary" style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Top Bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', flexShrink: 0 }}>
        <button onClick={() => router.push('/dashboard/problems')} className="btn btn-ghost btn-icon" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Problem #{problem.number}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{problem.title}</h1>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left column - Details */}
        <div style={{ flex: 1.5, padding: '24px 32px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Properties Card */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Properties</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: PROBLEM_STATUS_COLORS[problem.status] }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PROBLEM_STATUS_COLORS[problem.status] }} />
                    {problem.status}
                    <ChevronDown size={11} />
                  </button>
                  {openDropdown === 'status' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, minWidth: 160, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                      {STATUS_OPTIONS.map(s => (
                        <div key={s} onClick={() => { updateField('status', s); setOpenDropdown(null); }}
                          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: s === problem.status ? 'var(--accent)' : 'var(--text)', background: s === problem.status ? 'var(--accent-subtle)' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PROBLEM_STATUS_COLORS[s] }} /> {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Priority</label>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: PRIORITY_COLORS[problem.priority] }}>
                    {problem.priority}
                    <ChevronDown size={11} />
                  </button>
                  {openDropdown === 'priority' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, minWidth: 160, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                      {PRIORITY_OPTIONS.map(p => (
                        <div key={p} onClick={() => { updateField('priority', p); setOpenDropdown(null); }}
                          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: p === problem.priority ? 'var(--accent)' : 'var(--text)', background: p === problem.priority ? 'var(--accent-subtle)' : 'transparent', fontWeight: p === problem.priority ? 600 : 400 }}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Assigned To</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{problem.assigned_to_name || 'Unassigned'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Category</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{problem.category_name || 'None'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Created By</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{problem.created_by_name}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Created</label>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{formatDateTime(problem.created_at)}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Description</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {problem.description || 'No description provided.'}
            </p>
          </div>

          {/* Root Cause */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Root Cause Analysis</h3>
              {!editingRootCause && (
                <button onClick={() => { setEditingRootCause(true); setRootCauseDraft(problem.root_cause || ''); }} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                  <Edit2 size={13} />
                </button>
              )}
            </div>
            {editingRootCause ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={rootCauseDraft} onChange={e => setRootCauseDraft(e.target.value)} className="textarea" rows={4} style={{ width: '100%', resize: 'vertical', fontSize: 14 }} autoFocus />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingRootCause(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={saveRootCause} className="btn btn-primary btn-sm"><Check size={13} /> Save</button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {problem.root_cause || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No root cause documented yet.</span>}
              </p>
            )}
          </div>

          {/* Workaround */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Workaround</h3>
              {!editingWorkaround && (
                <button onClick={() => { setEditingWorkaround(true); setWorkaroundDraft(problem.workaround || ''); }} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                  <Edit2 size={13} />
                </button>
              )}
            </div>
            {editingWorkaround ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={workaroundDraft} onChange={e => setWorkaroundDraft(e.target.value)} className="textarea" rows={4} style={{ width: '100%', resize: 'vertical', fontSize: 14 }} autoFocus />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingWorkaround(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={saveWorkaround} className="btn btn-primary btn-sm"><Check size={13} /> Save</button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {problem.workaround || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No workaround documented yet.</span>}
              </p>
            )}
          </div>

          {/* Resolution */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Resolution</h3>
              {!editingResolution && (
                <button onClick={() => { setEditingResolution(true); setResolutionDraft(problem.resolution || ''); }} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                  <Edit2 size={13} />
                </button>
              )}
            </div>
            {editingResolution ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={resolutionDraft} onChange={e => setResolutionDraft(e.target.value)} className="textarea" rows={4} style={{ width: '100%', resize: 'vertical', fontSize: 14 }} autoFocus />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingResolution(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={saveResolution} className="btn btn-primary btn-sm"><Check size={13} /> Save</button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {problem.resolution || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No resolution documented yet.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right column - Incidents, Known Errors, Activity */}
        <div style={{ flex: 1, borderLeft: '1px solid var(--border)', overflow: 'auto', background: 'var(--bg-secondary)' }}>

          {/* Linked Incidents */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Linked Incidents</h3>
              <button onClick={() => setShowLinkPanel(true)} className="btn btn-ghost btn-sm" style={{ gap: 4, color: 'var(--accent)' }}>
                <Link2 size={13} /> Link
              </button>
            </div>
            {(!problem.linked_incidents || problem.linked_incidents.length === 0) ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No incidents linked to this problem.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {problem.linked_incidents.map((inc: LinkedIncident) => (
                  <div key={inc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>#{inc.number}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{inc.link_type}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</div>
                    </div>
                    <button onClick={() => window.open(`/dashboard/tickets/${inc.id}`, '_blank')} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }} title="Open incident">
                      <ExternalLink size={13} />
                    </button>
                    <button onClick={() => handleUnlinkIncident(inc.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }} title="Unlink"
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link Incident Panel */}
          {showLinkPanel && (
            <div style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>Link Incident</h4>
              {linkError && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{linkError}</span>
                  <button onClick={() => setLinkError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18 }}>×</button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Search Ticket</label>
                  <input value={linkSearch} onChange={e => searchTickets(e.target.value)} className="input" placeholder="Search by title or number..." style={{ width: '100%', height: 32, fontSize: 12 }} />
                  {ticketSearchResults.length > 0 && (
                    <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 180, overflow: 'auto', background: 'var(--bg)' }}>
                      {ticketSearchResults.map(t => (
                        <div key={t.id} onClick={() => { setLinkIncidentId(t.id); setLinkSearch(`#${t.number} ${t.title}`); setTicketSearchResults([]); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <strong>#{t.number}</strong> {t.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Link Type</label>
                  <select value={linkType} onChange={e => setLinkType(e.target.value)} className="select" style={{ width: '100%' }}>
                    <option value="related">Related</option>
                    <option value="caused_by">Caused By</option>
                    <option value="contributing">Contributing</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowLinkPanel(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={handleLinkIncident} disabled={submitting || !linkIncidentId} className="btn btn-primary btn-sm">{submitting ? '...' : 'Link'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Activity</h3>
            {(!problem.activity || problem.activity.length === 0) ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No activity recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {problem.activity.map((act: any) => {
                  let IconComponent = Activity;
                  let iconColor = 'var(--text-muted)';
                  if (act.action === 'status_changed') { IconComponent = AlertTriangle; iconColor = 'var(--success)'; }
                  else if (act.action === 'priority') { IconComponent = AlertTriangle; iconColor = 'var(--warning)'; }
                  else if (act.action === 'assigned_to_id') { IconComponent = UserIcon; iconColor = 'var(--info)'; }
                  else if (act.action === 'incident_linked' || act.action === 'incident_unlinked') { IconComponent = Link2; iconColor = 'var(--accent)'; }

                  const actionLabel = act.action.replace(/_/g, ' ');
                  const oldVal = act.old_value || '';
                  const newVal = act.new_value || '';
                  let actionText = `${act.actor_name || 'System'} ${actionLabel}`;
                  if (oldVal && newVal) {
                    if (act.action === 'status_changed') actionText = `${act.actor_name} changed status from ${oldVal} to ${newVal}`;
                    else if (act.action === 'priority') actionText = `${act.actor_name} changed priority from ${oldVal} to ${newVal}`;
                    else actionText = `${act.actor_name} ${actionLabel}: ${oldVal} → ${newVal}`;
                  } else if (newVal) {
                    actionText = `${act.actor_name} ${actionLabel}: ${newVal}`;
                  }

                  return (
                    <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconComponent size={14} color={iconColor} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{actionText}</div>
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
