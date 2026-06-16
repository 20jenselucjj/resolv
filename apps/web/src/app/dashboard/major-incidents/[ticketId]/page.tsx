'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date-utils';
import {
  ArrowLeft, ExternalLink, X, Edit2, Check,
  AlertTriangle, Clock, CheckCircle, FileText, ClipboardList,
  Star, Radio, User, Phone, MessageSquare, Link, Send,
  ChevronDown, Activity
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: '#dc2626',
  stabilized: '#f59e0b',
  resolved: '#059669',
  post_review: '#2563eb',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  stabilized: 'Stabilized',
  resolved: 'Resolved',
  post_review: 'Post Review',
};

const TIMELINE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  declaration:    { label: 'Declaration',   color: '#dc2626', icon: Radio },
  update:         { label: 'Update',        color: '#2563eb', icon: Activity },
  milestone:      { label: 'Milestone',     color: '#f59e0b', icon: Star },
  communication:  { label: 'Communication', color: '#8b5cf6', icon: MessageSquare },
  resolution:     { label: 'Resolution',    color: '#059669', icon: CheckCircle },
  pir:            { label: 'PIR Entry',     color: '#2563eb', icon: ClipboardList },
};

const TIMELINE_TYPE_OPTIONS = [
  { value: 'update', label: 'Update' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'communication', label: 'Communication' },
];

const STATUS_OPTIONS = ['active', 'stabilized', 'resolved', 'post_review'];

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  major_incident_id: string;
  entry_type: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

interface MajorIncident {
  id: string;
  ticket_id: string;
  ticket_number: number;
  ticket_title: string;
  ticket_description: string;
  ticket_created_by_name: string;
  ticket_created_by_id: string;
  ticket_priority: string;
  status: string;
  incident_commander_id: string | null;
  incident_commander_name: string | null;
  incident_commander_avatar: string | null;
  bridge_url: string | null;
  conference_dialin: string | null;
  slack_channel: string | null;
  services_affected: string[];
  declared_at: string;
  resolved_at: string | null;
  pir_completed: boolean;
  pir_notes: string | null;
  duration_seconds: number | null;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr).getTime();
  if (Number.isNaN(date)) return '';
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return 'Just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MajorIncidentDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const router = useRouter();
  const { user } = useStore();
  const [incident, setIncident] = useState<MajorIncident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Commander search state
  const [showCommanderSearch, setShowCommanderSearch] = useState(false);
  const [commanderQuery, setCommanderQuery] = useState('');
  const [commanderResults, setCommanderResults] = useState<UserSearchResult[]>([]);
  const [searchingCommander, setSearchingCommander] = useState(false);

  // Inline edit states
  const [editingBridge, setEditingBridge] = useState(false);
  const [bridgeDraft, setBridgeDraft] = useState('');
  const [editingConference, setEditingConference] = useState(false);
  const [conferenceDraft, setConferenceDraft] = useState('');
  const [editingSlack, setEditingSlack] = useState(false);
  const [slackDraft, setSlackDraft] = useState('');
  const [editingServices, setEditingServices] = useState(false);
  const [servicesDraft, setServicesDraft] = useState('');
  const [editingPir, setEditingPir] = useState(false);
  const [pirDraft, setPirDraft] = useState('');

  // Add timeline entry
  const [newEntryContent, setNewEntryContent] = useState('');
  const [newEntryType, setNewEntryType] = useState('update');
  const [submittingEntry, setSubmittingEntry] = useState(false);

  // Quick actions
  const [showPirModal, setShowPirModal] = useState(false);
  const [pirModalNotes, setPirModalNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const timelineEndRef = useRef<HTMLDivElement>(null);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchIncident = useCallback(async () => {
    try {
      const res = await api.get<{ data: MajorIncident }>(`/major-incidents/${ticketId}`);
      setIncident(res.data);
      setBridgeDraft(res.data.bridge_url || '');
      setConferenceDraft(res.data.conference_dialin || '');
      setSlackDraft(res.data.slack_channel || '');
      setServicesDraft((res.data.services_affected || []).join(', '));
      setPirDraft(res.data.pir_notes || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load major incident');
    }
  }, [ticketId]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await api.get<{ data: TimelineEntry[] }>(`/major-incidents/${ticketId}/timeline`);
      setTimeline(res.data || []);
    } catch { /* skip */ }
  }, [ticketId]);

  useEffect(() => {
    if (!isAdminOrAgent) return;
    Promise.all([fetchIncident(), fetchTimeline()]).finally(() => setLoading(false));
  }, [ticketId, isAdminOrAgent]);

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  // ─── Update helpers ─────────────────────────────────────────────────────

  const updateField = async (field: string, value: any) => {
    try {
      const res = await api.patch<{ data: MajorIncident }>(`/major-incidents/${ticketId}`, { [field]: value });
      setIncident(res.data);
    } catch (err: any) {
      setError(err.message || 'Update failed');
    }
  };

  const updateCommander = async (userId: string | null) => {
    await updateField('incident_commander_id', userId);
    setShowCommanderSearch(false);
    setCommanderQuery('');
    setCommanderResults([]);
  };

  const saveBridge = async () => {
    await updateField('bridge_url', bridgeDraft || null);
    setEditingBridge(false);
  };

  const saveConference = async () => {
    await updateField('conference_dialin', conferenceDraft || null);
    setEditingConference(false);
  };

  const saveSlack = async () => {
    await updateField('slack_channel', slackDraft || null);
    setEditingSlack(false);
  };

  const saveServices = async () => {
    const services = servicesDraft.split(',').map(s => s.trim()).filter(Boolean);
    await updateField('services_affected', services);
    setEditingServices(false);
  };

  const savePir = async () => {
    await updateField('pir_notes', pirDraft || null);
    setEditingPir(false);
  };

  // ─── Commander search ───────────────────────────────────────────────────

  const searchCommander = async (q: string) => {
    setCommanderQuery(q);
    if (!q.trim()) { setCommanderResults([]); return; }
    setSearchingCommander(true);
    try {
      const res = await api.get<{ data: UserSearchResult[] }>(`/users?search=${encodeURIComponent(q)}&pageSize=8`);
      setCommanderResults(res.data || []);
    } catch { setCommanderResults([]); }
    finally { setSearchingCommander(false); }
  };

  // ─── Timeline ───────────────────────────────────────────────────────────

  const handleAddEntry = async () => {
    if (!newEntryContent.trim()) return;
    setSubmittingEntry(true);
    try {
      await api.post(`/major-incidents/${ticketId}/timeline`, {
        entry_type: newEntryType,
        content: newEntryContent.trim(),
      });
      setNewEntryContent('');
      setNewEntryType('update');
      fetchTimeline();
    } catch (err: any) {
      setError(err.message || 'Failed to add timeline entry');
    } finally {
      setSubmittingEntry(false);
    }
  };

  // ─── Quick actions ──────────────────────────────────────────────────────

  const handleResolve = async () => {
    if (!confirm('Resolve this major incident? This will add a resolution timeline entry.')) return;
    setSubmittingAction(true);
    try {
      await api.post(`/major-incidents/${ticketId}/resolve`, {});
      await fetchIncident();
      await fetchTimeline();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCompletePir = async () => {
    setPirModalNotes(incident?.pir_notes || '');
    setShowPirModal(true);
  };

  const submitPir = async () => {
    setSubmittingAction(true);
    try {
      await api.post(`/major-incidents/${ticketId}/complete-pir`, { pir_notes: pirModalNotes || null });
      setShowPirModal(false);
      await fetchIncident();
      await fetchTimeline();
    } catch (err: any) {
      setError(err.message || 'Failed to complete PIR');
    } finally {
      setSubmittingAction(false);
    }
  };

  // ─── Render helpers ─────────────────────────────────────────────────────

  const renderStatusBadge = (status: string, large?: boolean) => {
    const color = STATUS_COLORS[status] || '#6b7280';
    const size = large ? { padding: '6px 16px', fontSize: 13, gap: 8 } : { padding: '3px 10px', fontSize: 11, gap: 6 };
    const dotSize = large ? 10 : 6;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: size.gap,
        padding: size.padding, borderRadius: 20, fontWeight: 700,
        background: `${color}18`, color, border: `1px solid ${color}30`,
      }}>
        <span style={{
          width: dotSize, height: dotSize, borderRadius: '50%', background: color,
          animation: status === 'active' ? 'pulse-red 1.5s ease-in-out infinite' : 'none',
        }} />
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  const renderTimelineIcon = (type: string) => {
    const config = TIMELINE_TYPE_CONFIG[type];
    if (!config) return <Activity size={16} color="var(--text-muted)" />;
    const Icon = config.icon;
    return <Icon size={16} color={config.color} />;
  };

  // ─── Auth gate ──────────────────────────────────────────────────────────

  if (!isAdminOrAgent) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Access Denied</div>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 24, width: 200 }} />
        <div className="skeleton" style={{ height: 36, width: '60%' }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  // ─── Error / Not found ──────────────────────────────────────────────────

  if (!incident) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Major incident not found</div>
        <button onClick={() => router.push('/dashboard/major-incidents')} className="btn btn-secondary" style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
      `}</style>

      {/* ─── Top Bar ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--card)', flexShrink: 0,
      }}>
        <button onClick={() => router.push('/dashboard/major-incidents')}
          className="btn btn-ghost btn-icon" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: '#dc262615', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Radio size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
              Major Incident · #{incident.ticket_number}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              {incident.ticket_title}
            </h1>
          </div>
        </div>
        {renderStatusBadge(incident.status, true)}
      </div>

      {/* ─── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8,
          padding: '10px 16px', margin: '12px 24px 0', color: 'var(--danger)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* ─── Main content ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ═══ Left column: Incident Command + Timeline ═══ */}
        <div style={{ flex: 1.7, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>

          {/* ── Incident Command Card ────────────────────────────────── */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '20px',
            animation: 'popIn 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Radio size={14} /> Incident Command
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {incident.status !== 'resolved' && incident.status !== 'post_review' && (
                  <>
                    <button onClick={handleResolve} disabled={submittingAction}
                      className="btn btn-sm"
                      style={{ gap: 4, background: 'var(--success)', color: '#fff', border: 'none', fontSize: 11, opacity: submittingAction ? 0.6 : 1 }}>
                      <CheckCircle size={12} /> Resolve
                    </button>
                    <button onClick={handleCompletePir}
                      className="btn btn-sm"
                      style={{ gap: 4, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 11 }}>
                      <ClipboardList size={12} /> PIR
                    </button>
                  </>
                )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: 4, fontSize: 11 }}>
                    Change Status <ChevronDown size={10} />
                  </button>
                  {openDropdown === 'status' && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 4,
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 8, zIndex: 50, minWidth: 160, padding: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    }}>
                      {STATUS_OPTIONS.filter(s => s !== incident.status).map(s => (
                        <div key={s} onClick={() => { updateField('status', s); setOpenDropdown(null); }}
                          style={{
                            padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                            color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[s] }} />
                          {STATUS_LABELS[s]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Incident Commander */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Incident Commander</label>
                {showCommanderSearch ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={14} color="var(--text-muted)" />
                      <input
                        value={commanderQuery}
                        onChange={e => searchCommander(e.target.value)}
                        className="input"
                        placeholder="Search users..."
                        style={{ height: 32, fontSize: 12, flex: 1 }}
                        autoFocus
                      />
                      <button onClick={() => { setShowCommanderSearch(false); setCommanderQuery(''); setCommanderResults([]); }}
                        className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                        <X size={14} />
                      </button>
                    </div>
                    {commanderResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        maxHeight: 200, overflow: 'auto', background: 'var(--bg)', zIndex: 60,
                      }}>
                        {commanderResults.map(u => (
                          <div key={u.id} onClick={() => { updateCommander(u.id); }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                              borderBottom: '1px solid var(--border)', color: 'var(--text)',
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
                              color: 'var(--text-inverse)', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0,
                            }}>{u.name[0].toUpperCase()}</div>
                            <div>
                              <div style={{ color: 'var(--text)', fontWeight: 500 }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => updateCommander(null)}
                      style={{
                        marginTop: 4, fontSize: 11, color: 'var(--text-muted)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      }}>
                      Remove commander
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => setShowCommanderSearch(true)}>
                    {incident.incident_commander_name ? (
                      <>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                          color: 'var(--text-inverse)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {incident.incident_commander_name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {incident.incident_commander_name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click to change</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                        <User size={16} />
                        <span style={{ fontStyle: 'italic' }}>Assign commander</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Declaration time + Duration */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Timeline</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} />
                    Declared {timeAgo(incident.declared_at)} ({formatDateTime(incident.declared_at)})
                  </div>
                  {incident.resolved_at ? (
                    <div style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={12} />
                      Resolved {timeAgo(incident.resolved_at)} · Duration: {formatDuration(incident.duration_seconds)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Radio size={12} />
                      Still active · {timeAgo(incident.declared_at)} elapsed
                    </div>
                  )}
                </div>
              </div>

              {/* Bridge URL */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  <Link size={11} style={{ marginRight: 3 }} /> Bridge URL
                </label>
                {editingBridge ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={bridgeDraft} onChange={e => setBridgeDraft(e.target.value)}
                      className="input" placeholder="https://..." style={{ height: 32, fontSize: 12, flex: 1 }} autoFocus />
                    <button onClick={saveBridge} className="btn btn-primary btn-sm btn-icon"><Check size={13} /></button>
                    <button onClick={() => { setEditingBridge(false); setBridgeDraft(incident.bridge_url || ''); }}
                      className="btn btn-ghost btn-sm btn-icon"><X size={13} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 32 }}
                    onClick={() => setEditingBridge(true)}>
                    {incident.bridge_url ? (
                      <>
                        <a href={incident.bridge_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={12} /> {incident.bridge_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                        <Edit2 size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Link size={12} /> Add bridge URL
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Conference Dial-in */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  <Phone size={11} style={{ marginRight: 3 }} /> Conference Dial-in
                </label>
                {editingConference ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={conferenceDraft} onChange={e => setConferenceDraft(e.target.value)}
                      className="input" placeholder="+1 555-..." style={{ height: 32, fontSize: 12, flex: 1 }} autoFocus />
                    <button onClick={saveConference} className="btn btn-primary btn-sm btn-icon"><Check size={13} /></button>
                    <button onClick={() => { setEditingConference(false); setConferenceDraft(incident.conference_dialin || ''); }}
                      className="btn btn-ghost btn-sm btn-icon"><X size={13} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 32 }}
                    onClick={() => setEditingConference(true)}>
                    {incident.conference_dialin ? (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>{incident.conference_dialin}</span>
                        <Edit2 size={12} color="var(--text-muted)" />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12} /> Add dial-in
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Slack Channel */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  <MessageSquare size={11} style={{ marginRight: 3 }} /> Slack Channel
                </label>
                {editingSlack ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={slackDraft} onChange={e => setSlackDraft(e.target.value)}
                      className="input" placeholder="#incident-response" style={{ height: 32, fontSize: 12, flex: 1 }} autoFocus />
                    <button onClick={saveSlack} className="btn btn-primary btn-sm btn-icon"><Check size={13} /></button>
                    <button onClick={() => { setEditingSlack(false); setSlackDraft(incident.slack_channel || ''); }}
                      className="btn btn-ghost btn-sm btn-icon"><X size={13} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 32 }}
                    onClick={() => setEditingSlack(true)}>
                    {incident.slack_channel ? (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MessageSquare size={12} /> {incident.slack_channel}
                        </span>
                        <Edit2 size={12} color="var(--text-muted)" />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MessageSquare size={12} /> Add channel
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Services Affected */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Services Affected</label>
                {editingServices ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={servicesDraft} onChange={e => setServicesDraft(e.target.value)}
                      className="input" placeholder="api, web-app, database" style={{ height: 32, fontSize: 12, flex: 1 }} autoFocus />
                    <button onClick={saveServices} className="btn btn-primary btn-sm btn-icon"><Check size={13} /></button>
                    <button onClick={() => { setEditingServices(false); setServicesDraft((incident.services_affected || []).join(', ')); }}
                      className="btn btn-ghost btn-sm btn-icon"><X size={13} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 32, flexWrap: 'wrap' }}
                    onClick={() => setEditingServices(true)}>
                    {(incident.services_affected || []).length > 0 ? (
                      <>
                        {(incident.services_affected || []).map(s => (
                          <span key={s} style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                            background: '#dc262610', color: '#dc2626',
                          }}>{s}</span>
                        ))}
                        <Edit2 size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Add services affected</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Timeline ──────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            animation: 'popIn 0.2s ease-out 0.05s both',
          }}>
            {/* Timeline header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Activity size={14} /> War Room Log
                <span style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                  background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 6, marginLeft: 4,
                }}>
                  {timeline.length} entries
                </span>
              </h3>
            </div>

            {/* Add entry form */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={newEntryType} onChange={e => setNewEntryType(e.target.value)}
                  className="select"
                  style={{ height: 36, fontSize: 12, width: 130, background: 'var(--bg)' }}>
                  {TIMELINE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button onClick={handleAddEntry} disabled={submittingEntry || !newEntryContent.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ gap: 4, marginLeft: 'auto', opacity: submittingEntry || !newEntryContent.trim() ? 0.6 : 1 }}>
                  <Send size={13} /> {submittingEntry ? 'Posting...' : 'Post Update'}
                </button>
              </div>
              <textarea
                value={newEntryContent}
                onChange={e => setNewEntryContent(e.target.value)}
                className="textarea"
                placeholder="Add an update to the war room log..."
                rows={3}
                style={{ width: '100%', resize: 'vertical', fontSize: 13, background: 'var(--bg)' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAddEntry();
                  }
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                <span style={{ background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>⌘Enter</span> to post
              </div>
            </div>

            {/* Timeline entries */}
            <div style={{ maxHeight: 500, overflow: 'auto', padding: '8px 0' }}>
              {timeline.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <Activity size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No timeline entries yet.</div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Post the first update above.
                  </p>
                </div>
              ) : (
                [...timeline].reverse().map((entry, idx) => {
                  const config = TIMELINE_TYPE_CONFIG[entry.entry_type];
                  const color = config?.color || 'var(--text-muted)';
                  const IconComp = config?.icon || Activity;
                  return (
                    <div key={entry.id} style={{
                      display: 'flex', gap: 14, padding: '12px 20px',
                      borderBottom: idx < timeline.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      animation: `slideUp 0.15s ease-out ${idx * 0.02}s both`,
                    }}>
                      {/* Timeline dot */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `${color}15`, border: `2px solid ${color}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconComp size={14} color={color} />
                        </div>
                        {idx < timeline.length - 1 && (
                          <div style={{ width: 2, flex: 1, minHeight: 16, background: 'var(--border-subtle)', marginTop: 4 }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color,
                          }}>
                            {config?.label || entry.entry_type}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {entry.author_name}
                          </span>
                        </div>
                        <p style={{
                          fontSize: 13, lineHeight: 1.6, color: 'var(--text)',
                          whiteSpace: 'pre-wrap', margin: '0 0 4px',
                        }}>
                          {entry.content}
                        </p>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {formatDateTime(entry.created_at)} ({timeAgo(entry.created_at)})
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={timelineEndRef} />
            </div>
          </div>

          {/* ── PIR Section ────────────────────────────────────────────── */}
          {(incident.status === 'resolved' || incident.status === 'post_review') && (
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '20px',
              animation: 'popIn 0.2s ease-out 0.1s both',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <FileText size={14} /> Post-Incident Review
                  {incident.pir_completed && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#059669',
                      background: '#05966910', padding: '1px 6px', borderRadius: 6,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      <CheckCircle size={10} /> Completed
                    </span>
                  )}
                </h3>
                {!editingPir && (
                  <button onClick={() => { setEditingPir(true); setPirDraft(incident.pir_notes || ''); }}
                    className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-muted)' }}>
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
              {editingPir ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea value={pirDraft} onChange={e => setPirDraft(e.target.value)}
                    className="textarea" rows={5}
                    style={{ width: '100%', resize: 'vertical', fontSize: 13 }} autoFocus
                    placeholder="Document lessons learned, what went well, what could be improved..."
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditingPir(false); setPirDraft(incident.pir_notes || ''); }}
                      className="btn btn-ghost btn-sm">Cancel</button>
                    <button onClick={savePir} className="btn btn-primary btn-sm"><Check size={13} /> Save</button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {incident.pir_notes || (
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      No PIR notes yet. Click the edit button to document the post-incident review.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ═══ Right panel: Linked Ticket info ═══ */}
        <div style={{
          flex: 1, maxWidth: 360, borderLeft: '1px solid var(--border)',
          overflow: 'auto', background: 'var(--bg-secondary)',
        }}>
          {/* Linked Ticket */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertTriangle size={14} /> Linked Ticket
            </h3>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#dc2626',
                  background: '#dc262610', padding: '1px 6px', borderRadius: 4,
                }}>
                  P1
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                  #{incident.ticket_number}
                </span>
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.4 }}>
                {incident.ticket_title}
              </h4>
              <p style={{
                fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
                margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {incident.ticket_description || 'No description'}
              </p>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Created by <strong style={{ color: 'var(--text-secondary)' }}>{incident.ticket_created_by_name}</strong>
                <br />
                {formatDateTime(incident.declared_at)}
              </div>
              <button
                onClick={() => window.open(`/dashboard/tickets/${incident.ticket_id}`, '_blank')}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', gap: 4, justifyContent: 'center' }}
              >
                <ExternalLink size={13} /> Open Original Ticket
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ padding: '20px' }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Clock size={14} /> Incident Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '12px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Timeline Entries</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{timeline.length}</span>
              </div>
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '12px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Services Affected</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
                  {(incident.services_affected || []).length}
                </span>
              </div>
              {incident.duration_seconds && (
                <div style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Duration</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {formatDuration(incident.duration_seconds)}
                  </span>
                </div>
              )}
              {incident.pir_completed && (
                <div style={{
                  background: '#05966908', border: '1px solid #05966930',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 8, color: '#059669',
                }}>
                  <CheckCircle size={14} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>PIR Completed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Complete PIR Modal ───────────────────────────────────────── */}
      {showPirModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 480,
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: '#2563eb15', color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ClipboardList size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Complete Post-Incident Review</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Document lessons learned. This will set the status to Post Review.
                </p>
              </div>
            </div>
            <textarea
              value={pirModalNotes}
              onChange={e => setPirModalNotes(e.target.value)}
              className="textarea"
              placeholder="What went well? What could be improved? What were the key lessons learned?"
              rows={6}
              style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button onClick={() => setShowPirModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={submitPir} disabled={submittingAction}
                className="btn btn-primary"
                style={{ background: '#2563eb', borderColor: '#2563eb', opacity: submittingAction ? 0.6 : 1 }}>
                {submittingAction ? 'Submitting...' : <><ClipboardList size={14} /> Complete PIR</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
