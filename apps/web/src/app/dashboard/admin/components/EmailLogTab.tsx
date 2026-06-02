'use client';

import { useEffect, useState, Fragment } from 'react';
import { Mail, RefreshCw, ChevronLeft, ChevronRight, ExternalLink, Search, ArrowDown, ArrowUp, Inbox, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface EmailLogEntry {
  id: string;
  ticket_id: string | null;
  direction: 'outbound' | 'inbound';
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
  processed_at: string | null;
  created_at: string;
  ticket_number: number | null;
  ticket_title: string | null;
}

interface EmailLogResponse {
  data: EmailLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  sent: { bg: 'var(--success-bg)', color: 'var(--success)' },
  failed: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  received: { bg: 'var(--accent-subtle)', color: 'var(--accent)' },
  processed: { bg: 'var(--success-bg)', color: 'var(--success)' },
  bounced: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
};

export function EmailLogTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const router = useRouter();
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ sent: number; received: number; failed: number }>({ sent: 0, received: 0, failed: 0 });

  const fetchLog = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (direction) params.set('direction', direction);
      if (status) params.set('status', status);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await api.get<EmailLogResponse>(`/admin/email/log?${params.toString()}`);
      const data = res.data || [];
      setEntries(data);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      
      // Compute quick stats from visible data
      setStats({
        sent: data.filter((e: EmailLogEntry) => e.status === 'sent' || e.status === 'processed').length,
        received: data.filter((e: EmailLogEntry) => e.status === 'received').length,
        failed: data.filter((e: EmailLogEntry) => e.status === 'failed' || e.status === 'bounced').length,
      });
    } catch {
      showAlert('Failed to load email log', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchLog();
  }, [page, direction, status, debouncedSearch]);

  const formatDate = (date: string) => new Date(date).toLocaleString();
  const statStyle = STATUS_COLORS as Record<string, { bg: string; color: string }>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={fetchLog} disabled={loading} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <RefreshCw size={14} style={{ marginRight: 6 }} />
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={16} />
          </div>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{stats.sent}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sent / Processed</div></div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Inbox size={16} />
          </div>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{stats.received}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Received</div></div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowDown size={16} />
          </div>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{stats.failed}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Failed / Bounced</div></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by subject, recipient, or body..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select className="select" value={direction} onChange={e => { setDirection(e.target.value); setPage(1); }} style={{ width: 150 }}>
          <option value="">All Directions</option>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
        <select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ width: 150 }}>
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="received">Received</option>
          <option value="processed">Processed</option>
          <option value="bounced">Bounced</option>
        </select>
        {(search || direction || status) && (
          <button onClick={() => { setSearch(''); setDirection(''); setStatus(''); setPage(1); }} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading email log...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Mail size={36} style={{ marginBottom: 12, opacity: 0.3, color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No email records found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {search || direction || status ? 'Try adjusting your search or filters.' : 'Emails will appear here once the system sends or receives messages.'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Time</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Direction</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To / From</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const st = statStyle[entry.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)' };
                    const isExpanded = expandedId === entry.id;
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          key={entry.id}
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                            {formatDate(entry.created_at)}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600 }}>
                            {entry.direction === 'inbound' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}><ArrowDown size={12} /> Inbound</span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}><ArrowUp size={12} /> Outbound</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px',
                              borderRadius: 'var(--radius-full)', background: st.bg,
                              color: st.color, fontSize: 11, fontWeight: 600,
                            }}>{entry.status}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.recipient_email || entry.sender_email || 'ΓÇö'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.subject || '(no subject)'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {entry.ticket_number ? (
                              <button
                                className="btn btn-ghost"
                                onClick={e => { e.stopPropagation(); router.push(`/dashboard/tickets/${entry.ticket_id}`); }}
                                style={{ fontSize: 12, padding: '3px 10px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 'var(--radius-sm)' }}
                              >
                                #{entry.ticket_number} <ExternalLink size={10} />
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ΓÇö</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${entry.id}-body`}>
                            <td colSpan={6} style={{ padding: '16px 18px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                                {entry.sender_email && <div><strong>From:</strong> {entry.sender_email}</div>}
                                {entry.recipient_email && <div><strong>To:</strong> {entry.recipient_email}</div>}
                                {entry.message_id && <div style={{ gridColumn: '1/-1' }}><strong>Message ID:</strong> <span style={{ fontFamily: 'monospace' }}>{entry.message_id}</span></div>}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Content</div>
                              <pre style={{ margin: 0, fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                {entry.body || entry.error_message || '(empty)'}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {entries.length > 0 ? `Showing ${(page - 1) * 50 + 1}ΓÇô${Math.min(page * 50, total)} of ${total}` : 'No entries'}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 4px' }}>Page {page} of {totalPages}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
