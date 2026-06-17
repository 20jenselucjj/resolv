'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  Search, ChevronDown, X, AlertTriangle,
  User, Phone, MessageSquare, Link,
  ExternalLink, Radio
} from 'lucide-react';
import { SkeletonPage } from '@/components/Skeleton';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'stabilized', label: 'Stabilized' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'post_review', label: 'Post Review' },
];

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

interface MajorIncident {
  id: string;
  ticket_id: string;
  ticket_number: number;
  ticket_title: string;
  status: string;
  priority: string;
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
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function MajorIncidentsPage() {
  const router = useRouter();
  const { user } = useStore();
  const [incidents, setIncidents] = useState<MajorIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [commanderFilter, setCommanderFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pageSize = 25;

  // Declare modal state
  const [showDeclare, setShowDeclare] = useState(false);
  const [declareTicketSearch, setDeclareTicketSearch] = useState('');
  const [ticketSearchResults, setTicketSearchResults] = useState<any[]>([]);
  const [searchingTickets, setSearchingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [declareCommanderQuery, setDeclareCommanderQuery] = useState('');
  const [commanderSearchResults, setCommanderSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingCommander, setSearchingCommander] = useState(false);
  const [selectedCommander, setSelectedCommander] = useState<UserSearchResult | null>(null);
  const [declareBridgeUrl, setDeclareBridgeUrl] = useState('');
  const [declareConference, setDeclareConference] = useState('');
  const [declareSlack, setDeclareSlack] = useState('');
  const [declareServices, setDeclareServices] = useState('');
  const [declaring, setDeclaring] = useState(false);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);
    if (commanderFilter) params.set('commander', commanderFilter);

    try {
      const res = await api.get<{ data: MajorIncident[]; total: number }>(`/major-incidents?${params}`);
      setIncidents(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load major incidents');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, commanderFilter]);

  useEffect(() => {
    if (isAdminOrAgent) fetchIncidents();
  }, [fetchIncidents, isAdminOrAgent]);

  const searchTickets = async (q: string) => {
    setDeclareTicketSearch(q);
    if (!q.trim()) { setTicketSearchResults([]); return; }
    setSearchingTickets(true);
    try {
      const res = await api.get<{ data: any[] }>(`/tickets?search=${encodeURIComponent(q)}&priority=critical&pageSize=10`);
      setTicketSearchResults(res.data.filter((t: any) => t.status !== 'closed' && t.status !== 'resolved'));
    } catch { setTicketSearchResults([]); }
    finally { setSearchingTickets(false); }
  };

  const searchCommander = async (q: string) => {
    setDeclareCommanderQuery(q);
    if (!q.trim()) { setCommanderSearchResults([]); return; }
    setSearchingCommander(true);
    try {
      const res = await api.get<{ data: UserSearchResult[] }>(`/users?search=${encodeURIComponent(q)}&pageSize=8`);
      setCommanderSearchResults(res.data || []);
    } catch { setCommanderSearchResults([]); }
    finally { setSearchingCommander(false); }
  };

  const handleDeclare = async () => {
    if (!selectedTicket) return;
    setDeclaring(true);
    try {
      await api.post('/major-incidents/declare', {
        ticket_id: selectedTicket.id,
        incident_commander_id: selectedCommander?.id || null,
        bridge_url: declareBridgeUrl || null,
        conference_dialin: declareConference || null,
        slack_channel: declareSlack || null,
        services_affected: declareServices ? declareServices.split(',').map(s => s.trim()).filter(Boolean) : [],
      });
      setShowDeclare(false);
      resetDeclareForm();
      fetchIncidents();
    } catch (err: any) {
      setError(err.message || 'Failed to declare major incident');
    } finally {
      setDeclaring(false);
    }
  };

  const resetDeclareForm = () => {
    setDeclareTicketSearch('');
    setTicketSearchResults([]);
    setSelectedTicket(null);
    setDeclareCommanderQuery('');
    setCommanderSearchResults([]);
    setSelectedCommander(null);
    setDeclareBridgeUrl('');
    setDeclareConference('');
    setDeclareSlack('');
    setDeclareServices('');
  };

  const totalPages = Math.ceil(total / pageSize);

  if (!isAdminOrAgent) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Access Denied</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Major incidents are internal and only available to agents and admins.</p>
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
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-md)',
            background: '#dc262615', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              Major Incidents
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#dc262615',
                padding: '1px 8px', borderRadius: 10, lineHeight: '20px',
              }}>
                {total}
              </span>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Critical incident command and war room management
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDeclare(true)}
          className="btn btn-primary btn-sm"
style={{ gap: 6, background: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            <Radio size={14} /> Declare Major Incident
        </button>
      </div>

      {/* Filters */}
      <div style={{
        padding: '10px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            placeholder="Search by ticket title..."
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
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', height: 32, fontSize: 11, fontWeight: 500, borderRadius: 8, border: `1px solid ${statusFilter !== 'all' ? STATUS_COLORS[statusFilter] : 'var(--border-subtle)'}`, background: statusFilter !== 'all' ? `${STATUS_COLORS[statusFilter]}15` : 'var(--bg)', color: statusFilter !== 'all' ? STATUS_COLORS[statusFilter] : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Status {statusFilter !== 'all' && <span style={{ color: 'var(--text)', marginLeft: 2 }}>{STATUS_LABELS[statusFilter]}</span>}
            <ChevronDown size={10} />
          </button>
          {openDropdown === 'status' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 160, padding: 4 }}>
              {STATUS_OPTIONS.map(opt => (
                <div key={opt.value} onClick={() => { setStatusFilter(opt.value); setPage(1); setOpenDropdown(null); }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: opt.value === statusFilter ? 'var(--accent)' : 'var(--text)', background: opt.value === statusFilter ? 'var(--accent-subtle)' : 'transparent', fontWeight: opt.value === statusFilter ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {opt.value !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[opt.value] }} />}
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commander filter */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
          <input
            placeholder="Filter by commander..."
            value={commanderFilter}
            onChange={(e) => { setCommanderFilter(e.target.value); setPage(1); }}
            className="input"
            style={{ paddingLeft: 8, height: 32, fontSize: 12, width: '100%', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 16px', margin: '16px 24px 0', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18 }}>×</button>
          </div>
        )}
        {loading ? (
          <SkeletonPage />
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }}>🚨</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>No major incidents</h3>
            <p style={{ fontSize: 14 }}>
              {statusFilter !== 'all' ? 'No incidents match the current filter.' : 'Declare a major incident from a critical ticket to start.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Ticket</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Commander</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Declared</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Duration</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Services</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, idx) => (
                <tr key={inc.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', animation: `popIn 0.2s ease-out ${idx * 0.03}s both` }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: `${STATUS_COLORS[inc.status]}18`,
                      color: STATUS_COLORS[inc.status],
                      border: `1px solid ${STATUS_COLORS[inc.status]}30`,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: STATUS_COLORS[inc.status],
                        animation: inc.status === 'active' ? 'pulse-red 1.5s ease-in-out infinite' : 'none',
                      }} />
                      {STATUS_LABELS[inc.status] || inc.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>#{inc.ticket_number}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.ticket_title}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#dc262610', padding: '1px 6px', borderRadius: 6, marginTop: 2, display: 'inline-block' }}>P1</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    {inc.incident_commander_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--accent)', color: 'var(--text-inverse)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>
                          {inc.incident_commander_name[0].toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--text)' }}>{inc.incident_commander_name}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{timeAgo(inc.declared_at)}</div>
                    <div>{new Date(inc.declared_at).toLocaleDateString()}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {inc.resolved_at ? (
                      <span style={{ color: '#059669', fontWeight: 600 }}>{formatDuration(inc.duration_seconds)}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 160 }}>
                      {(inc.services_affected || []).slice(0, 2).map(s => (
                        <span key={s} style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                          background: '#dc262610', color: '#dc2626',
                        }}>{s}</span>
                      ))}
                      {(inc.services_affected || []).length > 2 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{inc.services_affected.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/major-incidents/${inc.ticket_id}`); }}
                      className="btn btn-ghost btn-sm"
                      style={{ gap: 4, fontSize: 11 }}
                    >
                      <ExternalLink size={12} /> View
                    </button>
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

      {/* Declare Major Incident Modal */}
      {showDeclare && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'slideUp 0.15s ease-out',
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 520, maxWidth: 600,
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: '#dc262615', color: '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Radio size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Declare Major Incident</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Select a critical ticket to declare as a major incident
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Ticket search */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Critical Incident Ticket *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={declareTicketSearch}
                    onChange={e => searchTickets(e.target.value)}
                    className="input"
                    placeholder="Search for a critical incident ticket..."
                    style={{ width: '100%', height: 36, fontSize: 13 }}
                    autoFocus
                  />
                  {searchingTickets && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>Searching...</div>}
                  {selectedTicket && !declareTicketSearch && (
                    <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                      <button onClick={() => { setSelectedTicket(null); setDeclareTicketSearch(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {selectedTicket && (
                  <div style={{
                    marginTop: 6, padding: '8px 12px', background: '#dc262608', border: '1px solid #dc262620',
                    borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <AlertTriangle size={14} color="#dc2626" />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>#{selectedTicket.number}</span>
                      <span style={{ fontSize: 12, color: 'var(--text)', marginLeft: 6 }}>{selectedTicket.title}</span>
                    </div>
                  </div>
                )}
                {!selectedTicket && ticketSearchResults.length > 0 && (
                  <div style={{
                    marginTop: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    maxHeight: 200, overflow: 'auto', background: 'var(--bg)',
                  }}>
                    {ticketSearchResults.map(t => (
                      <div key={t.id} onClick={() => { setSelectedTicket(t); setDeclareTicketSearch(''); setTicketSearchResults([]); }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#dc262610', padding: '1px 5px', borderRadius: 4 }}>P1</span>
                        <strong style={{ fontSize: 11 }}>#{t.number}</strong>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incident Commander */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Incident Commander</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <input
                      value={selectedCommander ? selectedCommander.name : declareCommanderQuery}
                      onChange={e => { setSelectedCommander(null); searchCommander(e.target.value); }}
                      className="input"
                      placeholder="Search for a user..."
                      style={{ width: '100%', height: 36, fontSize: 13 }}
                    />
                    {selectedCommander && (
                      <button onClick={() => { setSelectedCommander(null); setDeclareCommanderQuery(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {!selectedCommander && commanderSearchResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                      maxHeight: 200, overflow: 'auto', background: 'var(--bg)', zIndex: 60,
                    }}>
                      {commanderSearchResults.map(u => (
                        <div key={u.id} onClick={() => { setSelectedCommander(u); setDeclareCommanderQuery(''); setCommanderSearchResults([]); }}
                          style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            {u.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ color: 'var(--text)', fontWeight: 500 }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bridge / Conference / Slack row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <Link size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Bridge URL
                  </label>
                  <input value={declareBridgeUrl} onChange={e => setDeclareBridgeUrl(e.target.value)}
                    className="input" placeholder="https://zoom.us/j/..." style={{ width: '100%', height: 36, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <Phone size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Conference Dial-in
                  </label>
                  <input value={declareConference} onChange={e => setDeclareConference(e.target.value)}
                    className="input" placeholder="+1 555-123-4567" style={{ width: '100%', height: 36, fontSize: 13 }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <MessageSquare size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Slack Channel
                </label>
                <input value={declareSlack} onChange={e => setDeclareSlack(e.target.value)}
                  className="input" placeholder="#incident-response" style={{ width: '100%', height: 36, fontSize: 13 }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Services Affected (comma separated)
                </label>
                <input value={declareServices} onChange={e => setDeclareServices(e.target.value)}
                  className="input" placeholder="api, web-app, database" style={{ width: '100%', height: 36, fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button onClick={() => { setShowDeclare(false); resetDeclareForm(); }} className="btn btn-ghost">Cancel</button>
              <button
                onClick={handleDeclare}
                disabled={declaring || !selectedTicket}
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', opacity: declaring || !selectedTicket ? 0.6 : 1 }}
              >
                {declaring ? 'Declaring...' : <><Radio size={14} /> Declare Major Incident</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
