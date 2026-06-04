'use client';
import { useRouter } from 'next/navigation';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, ArrowUpRight,
  Ghost, X, Plus, Calendar, Clock,
} from 'lucide-react';
import type { Ticket, User } from '@/lib/store';
import { formatDate } from '@/lib/date-utils';
import { InlineSelect } from '@/components/InlineSelect';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import {
  STATUS_OPTIONS, PRIORITY_OPTIONS, priorityColors, statusConfig, TYPE_CONFIG,
  PRIORITY_ORDER, STATUS_ORDER, ALL_COLUMNS,
} from './constants';
import { getDueDateColor, timeAgo } from './helpers';
import type { SortField, SortDir } from './types';

export function TicketTable({
  loading,
  loadingMore,
  hasMore,
  total,
  sentinelRef,
  sorted,
  selectedIds,
  toggleSelectAll,
  toggleSelect,
  visibleCols,
  colWidths,
  sortField,
  sortDir,
  toggleSort,
  resizeRef,
  rowPad,
  hasFilters,
  setShowNewTicketPanel,
  handleInlineUpdate,
  isAdminOrAgent,
  user,
  allUsers,
  clearFilters,
}: {
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  sorted: Ticket[];
  selectedIds: Set<string>;
  toggleSelectAll: () => void;
  toggleSelect: (id: string) => void;
  visibleCols: Set<string>;
  colWidths: Record<string, number>;
  sortField: SortField;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
  resizeRef: React.MutableRefObject<{ colId: string; startX: number; startWidth: number } | null>;
  rowPad: string;
  hasFilters: boolean;
  setShowNewTicketPanel: (v: boolean) => void;
  handleInlineUpdate: (ticketId: string, updates: Partial<Ticket>) => void;
  isAdminOrAgent: boolean;
  user: User | null;
  allUsers: User[];
  clearFilters: () => void;
}) {
  const router = useRouter();

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {loading ? (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1,2,3,4,5,6,7,8].map((i) => (
            <div key={i} className="skeleton skeleton-shimmer" style={{ height: 52, borderRadius: 'var(--radius-lg)', opacity: 1 - (i * 0.1) }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: '120px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div style={{ 
            width: 100, height: 100, borderRadius: '32px', background: 'var(--bg-tertiary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            color: 'var(--accent)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
            border: '1px solid var(--border-subtle)',
            transform: 'rotate(-5deg)'
          }}>
            <Ghost size={48} strokeWidth={1.5} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.02em' }}>No tickets found</h3>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
            {hasFilters ? "We searched everywhere but couldn't find any tickets matching those filters. Try clearing some filters or searching for something else." : "Your ticket queue is currently empty. Create a new ticket to get started."}
          </p>
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="btn btn-secondary"
              style={{ borderRadius: 'var(--radius-full)', padding: '0 24px' }}
            >
              <X size={16} /> Clear all filters
            </button>
          ) : (
            <button
              onClick={() => setShowNewTicketPanel(true)}
              className="btn btn-primary"
              style={{ borderRadius: 'var(--radius-full)', padding: '0 24px', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.2)' }}
            >
              <Plus size={16} /> Create your first ticket
            </button>
          )}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', overflow: 'visible' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2, backdropFilter: 'blur(8px)', background: 'rgba(var(--bg-secondary-rgb), 0.9)' }}>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ width: 40, padding: '12px 16px' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === sorted.length && sorted.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)', transform: 'scale(1.1)' }}
                />
              </th>
              {ALL_COLUMNS.filter(c => visibleCols.has(c.id)).map(({ id, label, sortable, minWidth }) => {
                const w = colWidths[id];
                return (
                  <th
                    key={id}
                    style={{
                      padding: '12px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      width: w, minWidth, cursor: sortable ? 'pointer' : 'default',
                      userSelect: 'none', whiteSpace: 'nowrap',
                      position: 'relative',
                    }}
                    onClick={() => sortable && toggleSort(id as SortField)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                      {sortable && (
                        sortField === id
                          ? sortDir === 'asc'
                            ? <ChevronUp size={12} color="var(--accent)" strokeWidth={3} />
                            : <ChevronDown size={12} color="var(--accent)" strokeWidth={3} />
                          : <ChevronsUpDown size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        resizeRef.current = { colId: id, startX: e.clientX, startWidth: w || minWidth || 100 };
                        document.body.style.cursor = 'col-resize';
                        document.body.style.userSelect = 'none';
                      }}
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 4, cursor: 'col-resize', zIndex: 3,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    />
                  </th>
                );
              })}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => {
              const sc = statusConfig[t.status] || statusConfig.open;
              const tc = t.ticket_type ? TYPE_CONFIG[t.ticket_type] : null;
              const isSelected = selectedIds.has(t.id);
              const aName = t.assigned_to_name;
              const priorityColor = priorityColors[t.priority] || 'transparent';

              return (
                <tr
                  key={t.id}
                  className="row-animate ticket-row"
                  style={{
                    animationDelay: `${Math.min(idx * 0.02, 0.2)}s`,
                    borderBottom: '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                >
                  <td style={{ padding: rowPad, width: 40, borderLeft: `3px solid ${priorityColor}`, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(t.id)}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent)', transform: 'scale(1.1)' }}
                    />
                  </td>

                  {visibleCols.has('number') && (
                    <td
                      style={{ padding: rowPad, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}
                    >
                      #{t.number}
                    </td>
                  )}

                  {visibleCols.has('title') && (
                    <td
                      style={{ padding: rowPad, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          title={t.title}
                          style={{
                            fontSize: 14, fontWeight: 600,
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            padding: '3px 6px', borderRadius: 'var(--radius-sm)',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            position: 'relative',
                          }}
                          onMouseEnter={e => { 
                            e.currentTarget.style.background = 'var(--accent-subtle)'; 
                            e.currentTarget.style.color = 'var(--accent)';
                            e.currentTarget.style.transform = 'translateX(2px)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(var(--accent-rgb), 0.15)';
                          }}
                          onMouseLeave={e => { 
                            e.currentTarget.style.background = 'transparent'; 
                            e.currentTarget.style.color = 'var(--text)';
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {t.title}
                        </div>
                        {t.sla_breached && (
                          <div data-tooltip="SLA Breached" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-full)', border: '1px solid var(--danger-border)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            <Clock size={10} strokeWidth={2.5} /> SLA
                          </div>
                        )}
                      </div>

                    </td>
                  )}

                  {visibleCols.has('description') && (
                    <td style={{ padding: rowPad, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description ? (
                        <div
                          title={t.description}
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            padding: '3px 6px', borderRadius: 'var(--radius-sm)',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            lineHeight: 1.5,
                          }}
                          onMouseEnter={e => { 
                            e.currentTarget.style.background = 'var(--bg-tertiary)'; 
                            e.currentTarget.style.color = 'var(--text)';
                            e.currentTarget.style.transform = 'translateX(2px)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                          }}
                          onMouseLeave={e => { 
                            e.currentTarget.style.background = 'transparent'; 
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {t.description}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  )}

                  {visibleCols.has('ticket_type') && (
                    <td style={{ padding: rowPad, whiteSpace: 'nowrap' }}>
                      {tc ? (
                        <span style={{ 
                          fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-sm)', 
                          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em',
                          background: tc.bg, color: tc.color, border: tc.border,
                          whiteSpace: 'nowrap',
                        }}>
                          {tc.label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  )}

                  {visibleCols.has('status') && (
                    <td style={{ padding: rowPad, position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                      {isAdminOrAgent ? (
                        <InlineSelect
                          value={t.status}
                          options={STATUS_OPTIONS.filter(s => s !== 'all').map(s => ({ value: s, label: statusConfig[s]?.label || s }))}
                          onChange={(val) => handleInlineUpdate(t.id, { status: val as Ticket['status'] })}
                          renderValue={(val) => {
                            const sc2 = statusConfig[val] || statusConfig.open;
                            return <span className={sc2.badgeClass} style={{ padding: '4px 10px', fontSize: 11 }}>{sc2.label}</span>;
                          }}
                        />
                      ) : (
                        <span className={sc.badgeClass} style={{ padding: '4px 10px', fontSize: 11 }}>{sc.label}</span>
                      )}
                    </td>
                  )}

                  {visibleCols.has('priority') && (
                    <td style={{ padding: rowPad, position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                      {isAdminOrAgent ? (
                        <InlineSelect
                          value={t.priority}
                          options={PRIORITY_OPTIONS.filter(p => p !== 'all').map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                          onChange={(val) => handleInlineUpdate(t.id, { priority: val as Ticket['priority'] })}
                          renderValue={(val) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColors[val], flexShrink: 0, boxShadow: `0 0 8px ${priorityColors[val]}40` }} />
                              <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', fontWeight: 500 }}>{val}</span>
                            </div>
                          )}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColors[t.priority], flexShrink: 0, boxShadow: `0 0 8px ${priorityColors[t.priority]}40` }} />
                          <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', fontWeight: 500 }}>{t.priority}</span>
                        </div>
                      )}
                    </td>
                  )}

                  {visibleCols.has('assignee') && (
                    <td style={{ padding: rowPad, fontSize: 13, color: 'var(--text-secondary)', position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                      {isAdminOrAgent ? (
                        <UserSearchSelect
                          users={allUsers.filter(u => u.role === 'admin' || u.role === 'agent')}
                          value={t.assigned_to_id}
                          onChange={(val) => handleInlineUpdate(t.id, { assigned_to_id: val })}
                          placeholder="Unassigned"
                        />
                      ) : aName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {aName[0].toUpperCase()}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{aName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                  )}

                  {visibleCols.has('reporter') && (
                    <td style={{ padding: rowPad, fontSize: 13, color: 'var(--text-secondary)', position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                      {isAdminOrAgent ? (
                        <UserSearchSelect
                          users={allUsers}
                          value={t.created_by_id}
                          onChange={(val) => handleInlineUpdate(t.id, { created_by_id: val ?? undefined })}
                          placeholder="Select..."
                          hideClear
                        />
                      ) : t.created_by_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `hsl(${(t.created_by_name.charCodeAt(0) * 37 || 200) % 360}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {t.created_by_name[0].toUpperCase()}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.created_by_name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  )}

                  {visibleCols.has('due_date') && (
                    <td style={{ padding: rowPad, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {t.due_date ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: getDueDateColor(t.due_date), fontWeight: 600 }}>
                          <Calendar size={12} />
                          {formatDate(t.due_date)}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  )}

                  {visibleCols.has('created_at') && (
                    <td style={{ padding: rowPad, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {timeAgo(t.created_at)}
                    </td>
                  )}

                  {visibleCols.has('updated_at') && (
                    <td style={{ padding: rowPad, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {timeAgo(t.updated_at)}
                    </td>
                  )}

                  <td style={{ padding: rowPad, width: 40 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tickets/${t.id}`); }}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ opacity: 0, transition: 'opacity 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                      ref={(node) => { if (node && node.parentElement?.parentElement?.matches(':hover')) node.style.opacity = '0.5'; }}
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>
          Loading more tickets...
        </div>
      )}
      {!hasMore && !loading && sorted.length > 0 && total > 50 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
          All {total} tickets loaded
        </div>
      )}
    </div>
  );
}
