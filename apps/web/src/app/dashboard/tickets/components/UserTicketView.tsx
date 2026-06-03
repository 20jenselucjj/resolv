'use client';
import { useRouter } from 'next/navigation';
import { Plus, FileText } from 'lucide-react';
import { NewTicketPanel } from '@/components/NewTicketPanel';
import { TYPE_CONFIG, statusConfig } from './constants';
import { getDueDateColor } from './helpers';
import { formatDate } from '@/lib/date-utils';
import type { Ticket, User } from '@/lib/store';

export function UserTicketView({
  sorted,
  user,
  showNewTicketPanel,
  setShowNewTicketPanel,
  fetchTickets,
}: {
  sorted: Ticket[];
  user: User | null;
  showNewTicketPanel: boolean;
  setShowNewTicketPanel: (v: boolean) => void;
  fetchTickets: () => void;
}) {
  const router = useRouter();
  const myTickets = sorted.filter(t =>
    t.created_by_id === user?.id || t.assigned_to_id === user?.id || t.requested_by_name === user?.name
  );

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-secondary)',
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 4, height: 24, background: 'var(--accent)', borderRadius: 2 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            My Tickets
            <span style={{
              fontSize: 12, fontWeight: 600, marginLeft: 12, color: 'var(--text-muted)',
              padding: '2px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)',
            }}>
              {myTickets.length}
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowNewTicketPanel(true)}
          className="btn btn-primary"
          style={{ boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.25)', padding: '0 20px', height: 40, fontSize: 14, fontWeight: 600, gap: 8 }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Ticket
        </button>
      </div>

      {/* Search + List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {myTickets.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 24px', color: 'var(--text-muted)', gap: 12,
          }}>
            <FileText size={40} strokeWidth={1.5} opacity={0.3} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>No tickets yet</div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
              When you submit a ticket through the portal, it will appear here.
            </div>
            <button
              onClick={() => setShowNewTicketPanel(true)}
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '0 20px', height: 40, fontSize: 14, fontWeight: 600, gap: 8 }}
            >
              <Plus size={16} />
              Create Your First Ticket
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left', width: 60 }}>#</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left' }}>Title</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left', width: 110 }}>Type</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left', width: 100 }}>Status</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left', width: 110 }}>Due Date</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left', width: 130 }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {myTickets.map((t, idx) => (
                  <tr key={t.id}
                    onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg)',
                      cursor: 'pointer',
                      animation: `fadeUp 0.3s ease-out ${idx * 0.03}s both`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>#{t.number}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{t.title}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600,
                        background: TYPE_CONFIG[t.ticket_type || '']?.bg || 'var(--bg-tertiary)',
                        color: TYPE_CONFIG[t.ticket_type || '']?.color || 'var(--text-muted)',
                        border: TYPE_CONFIG[t.ticket_type || '']?.border || '1px solid var(--border)',
                      }}>
                        {TYPE_CONFIG[t.ticket_type || '']?.label || t.ticket_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={statusConfig[t.status]?.badgeClass || 'badge'} style={{ fontSize: 11 }}>
                        {statusConfig[t.status]?.label || t.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: getDueDateColor(t.due_date || undefined) }}>
                      {t.due_date ? formatDate(t.due_date) : '\u2014'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {(() => {
                        const d = new Date(t.updated_at);
                        const now = new Date();
                        const diff = now.getTime() - d.getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return 'Just now';
                        if (mins < 60) return `${mins}m ago`;
                        const hours = Math.floor(mins / 60);
                        if (hours < 24) return `${hours}h ago`;
                        return formatDate(t.updated_at);
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    {showNewTicketPanel && (
      <NewTicketPanel
        onClose={() => setShowNewTicketPanel(false)}
        onCreated={() => {
          setShowNewTicketPanel(false);
          fetchTickets();
        }}
      />
    )}
  </>
  );
}
