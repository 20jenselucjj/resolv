'use client';

import { useMemo } from 'react';
import { ArrowLeft, XCircle, X, Eye, MoreVertical, Printer, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Ticket } from '@/lib/store';
import { SelectSearch } from '@/components/SelectSearch';
import { PRIORITY_OPTIONS, CATEGORY_DOT_COLORS } from './constants';
import { useStatusConfig } from '@/lib/StatusConfigContext';
import { filterStatusesByType } from '@/lib/status-utils';
import { categoryColorIndex } from './helpers';

interface TopBarProps {
  ticket: Ticket;
  isAdminOrAgent: boolean;
  isClosing: boolean;
  closeNotesDraft: string;
  setCloseNotesDraft: (v: string) => void;
  setIsClosing: (v: boolean) => void;
  handleCloseTicket: () => void;
  submitting: boolean;
  presence: string[];
  handleStatusChange: (status: string) => void;
  showMenu: boolean;
  setShowMenu: (v: boolean) => void;
  sendEmailOnClose: boolean;
  setSendEmailOnClose: (v: boolean) => void;
}

export function TopBar({
  ticket, isAdminOrAgent, isClosing, closeNotesDraft, setCloseNotesDraft,
  setIsClosing, handleCloseTicket, submitting, presence, handleStatusChange,
  showMenu, setShowMenu, sendEmailOnClose, setSendEmailOnClose,
}: TopBarProps) {
  const router = useRouter();
  const { statusOptions, statusConfig, statusTicketTypes } = useStatusConfig();
  const currentStatus = statusOptions.find((s) => s.value === ticket.status);
  const filteredStatuses = useMemo(() =>
    filterStatusesByType(statusOptions.filter(s => s.value !== 'all'), ticket.ticket_type, statusTicketTypes || {}),
    [statusTicketTypes, statusOptions, ticket.ticket_type]
  );
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === ticket.priority);

  return (
    <div style={{
      padding: '12px 24px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      <button onClick={() => router.push('/dashboard/tickets')} className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
        <ArrowLeft size={13} /> Tickets
      </button>
      <span style={{ color: 'var(--border)', fontSize: 16 }}>/</span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
        #{ticket.number || ticket.id?.substring(0,8)}
      </span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16 }}>
        {currentPriority && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `color-mix(in srgb, ${currentPriority.color} 15%, transparent)`, color: currentPriority.color, padding: '2px 8px', borderRadius: '12px', fontSize: 11, fontWeight: 600 }}>
            {currentPriority.label}
          </div>
        )}
        {ticket.category_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '12px', fontSize: 11, color: 'var(--text-secondary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORY_DOT_COLORS[(ticket.category_id?.length ?? 0) % 6] }} />
            {ticket.category_name}
          </div>
        )}
        {ticket.sla_policy_id && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: '12px', fontSize: 11, fontWeight: 600,
            background: ticket.sla_breached ? 'var(--danger-bg)' : 'var(--bg-tertiary)',
            color: ticket.sla_breached ? 'var(--danger)' : 'var(--text-muted)',
            border: `1px solid ${ticket.sla_breached ? 'var(--danger-border)' : 'var(--border)'}`,
          }}>
            {ticket.sla_breached ? 'SLA Breached' : 'SLA On Track'}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Action buttons (Close) */}
      {ticket.status !== 'closed' && (
        <div style={{ display: 'flex', gap: 8, marginRight: 16 }}>
          {!isClosing ? (
            <button onClick={() => { setCloseNotesDraft(''); setIsClosing(true); }} className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }}>
              <XCircle size={13} /> Close
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <input placeholder="Closing note (required)..." value={closeNotesDraft} onChange={e => setCloseNotesDraft(e.target.value)} className="input" style={{ height: 28, fontSize: 12, width: 260 }} autoFocus />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendEmailOnClose} onChange={e => setSendEmailOnClose(e.target.checked)} style={{ cursor: 'pointer' }} />
                Email user
              </label>
              <button onClick={handleCloseTicket} disabled={!closeNotesDraft.trim() || submitting} className="btn btn-primary btn-sm" style={{ height: 28, padding: '0 8px' }}>Confirm</button>
              <button onClick={() => setIsClosing(false)} className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 4px' }}><X size={14} /></button>
            </div>
          )}
        </div>
      )}

      {/* Presence avatars */}
      {(presence || []).length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 16 }}>
          <Eye size={12} color="var(--text-muted)" />
          <div style={{ display: 'flex' }}>
            {presence.slice(0, 4).map((p, i) => (
              <div key={i} data-tooltip={p} style={{ width: 24, height: 24, borderRadius: '50%', background: `hsl(${(p.charCodeAt(0) * 37) % 360}, 60%, 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', border: '2px solid var(--bg-secondary)', marginLeft: i > 0 ? -6 : 0 }}>
                {p[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignee */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: ticket.assigned_to_name ? `hsl(${(ticket.assigned_to_name.charCodeAt(0) * 37) % 360}, 55%, 45%)` : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {ticket.assigned_to_name ? ticket.assigned_to_name[0].toUpperCase() : '?'}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{ticket.assigned_to_name || 'Unassigned'}</span>
      </div>

      {/* Status Dropdown */}
      {isAdminOrAgent ? (
        <div style={{ minWidth: 150 }}>
          <SelectSearch
            options={filteredStatuses}
            value={ticket.status}
            onChange={val => val && handleStatusChange(val)}
            placeholder="Change"
            hideClear
          />
        </div>
      ) : (
        <span className={statusConfig[ticket.status]?.badgeClass || 'badge'}>{currentStatus?.label || ticket.status}</span>
      )}

      {/* More Actions Menu */}
      <div style={{ position: 'relative', marginLeft: 8 }}>
        <button onClick={() => setShowMenu(!showMenu)} className="btn btn-ghost btn-icon btn-sm">
          <MoreVertical size={16} color="var(--text-muted)" />
        </button>
        {showMenu && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, zIndex: 50, minWidth: 140 }}>
            <button onClick={() => { setShowMenu(false); window.print(); }} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 12px' }}>
              <Printer size={13} style={{ marginRight: 6 }} /> Print ticket
            </button>
            <button onClick={() => {
              setShowMenu(false);
              const originalTitle = document.title;
              document.title = `Ticket #${ticket.number || ticket.id?.substring(0,8)} - ${ticket.title}`;
              window.print();
              document.title = originalTitle;
            }} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 12px' }}>
              <FileText size={13} style={{ marginRight: 6 }} /> Export / Print PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}