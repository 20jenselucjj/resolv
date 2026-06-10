'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Ticket as TicketIcon,
  TrendingUp,
  Monitor,
  LayoutGrid,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  UserPlus,
  BookOpen,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from 'lucide-react';
import { CardSection, MiniBar, MiniTable } from '../components/Charts';
import { EmptyState } from '../components/shared';
import {
  ScorecardWidget,
  InteractiveBarChart,
  InteractiveDonutChart,
  InteractiveLineChart,
  InteractiveAreaChart,
  HeatmapChart,
} from '../components/recharts';
import { STATUS_COLORS, PRIORITY_COLORS } from '../types';
import type { Ticket, DrillDownLevel, KnowledgeStats } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentPerf {
  name: string;
  count: number;
  resolved: number;
  breaches: number;
  totalResTime: number;
}

interface PortalStats {
  totalUsers: number;
  userRegistrations30d: number;
  totalTickets: number;
  serviceRequestCount: number;
  csatAvg: number | undefined;
  csatCount: number;
}

interface OperationalSectionProps {
  filteredTickets: Ticket[];
  tickets: Ticket[];
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (val: string) => void;
  priorityFilter: string;
  onPriorityChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  agentPerformance: AgentPerf[];
  portalStats: PortalStats;
  isAdminOrAgent: boolean;
  knowledgeStats?: KnowledgeStats | null;
  onExportCSV: (section: string) => void;
  onDrillDown?: (level: DrillDownLevel) => void;
  onCrossFilterChange?: (key: string, value: string | null) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

type SubTab = 'ticket-queue' | 'agent-workload' | 'operational-metrics' | 'portal';

interface SubTabConfig {
  key: SubTab;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const SUB_TABS: SubTabConfig[] = [
  { key: 'ticket-queue', label: 'Ticket Queue', icon: TicketIcon },
  { key: 'agent-workload', label: 'Agent Workload', icon: Users },
  { key: 'operational-metrics', label: 'Operational Metrics', icon: LayoutGrid },
  { key: 'portal', label: 'Portal & Self-Service', icon: Monitor },
];

// ── Color Constants ────────────────────────────────────────────────────────────

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  pending: '#8B5CF6',
  resolved: '#16A34A',
  closed: '#6B7280',
};

const SLA_STATUS_COLORS = {
  ok: '#16A34A',
  warning: '#F59E0B',
  breached: '#EF4444',
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getAge(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 1) return '<1h';
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ${diffHrs % 24}h`;
}

function getAgeHours(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000;
}

function getSlaStatus(ticket: Ticket): 'ok' | 'warning' | 'breached' {
  if (ticket.sla_breached) return 'breached';
  if (ticket.due_date && new Date(ticket.due_date).getTime() < Date.now() + 7200000) return 'warning';
  return 'ok';
}

function getAgentList(tickets: Ticket[]): string[] {
  const agents = new Set<string>();
  tickets.forEach(t => { if (t.assigned_to_name) agents.add(t.assigned_to_name); });
  return Array.from(agents).sort();
}

const STYLE = {
  tableHeader: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  tableCell: {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid var(--border-subtle)',
  },
  badge: (bg: string, color: string) => ({
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    background: bg + '20',
    color,
    border: `1px solid ${bg}40`,
    whiteSpace: 'nowrap' as const,
  }),
  filterLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: 6,
  },
};

// ── Sort Config ─────────────────────────────────────────────────────────────────

type SortField = 'number' | 'priority' | 'status' | 'assignee' | 'category' | 'created_at' | 'age';
type SortDir = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  dir: SortDir;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function sortTickets(tickets: Ticket[], sort: SortConfig): Ticket[] {
  const sorted = [...tickets];
  const dir = sort.dir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sort.field) {
      case 'number': cmp = a.number - b.number; break;
      case 'priority': cmp = (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
      case 'assignee':
        cmp = (a.assigned_to_name || '').localeCompare(b.assigned_to_name || '');
        break;
      case 'category':
        cmp = (a.category_name || '').localeCompare(b.category_name || '');
        break;
      case 'created_at':
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'age':
        cmp = getAgeHours(a.created_at) - getAgeHours(b.created_at);
        break;
    }
    return cmp * dir;
  });
  return sorted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: Ticket Queue
// ═══════════════════════════════════════════════════════════════════════════════

function TicketQueueTab({
  tickets,
  allTickets,
  onDrillDown,
  pinProps,
}: {
  tickets: Ticket[];
  allTickets: Ticket[];
  onDrillDown?: (level: DrillDownLevel) => void;
  pinProps: (key: string, label: string, type?: string) => Record<string, any>;
}) {
  // Local filter state
  const [statusChecks, setStatusChecks] = useState<Record<string, boolean>>({
    open: true,
    in_progress: true,
    pending: true,
    resolved: true,
  });
  const [priorityChecks, setPriorityChecks] = useState<Record<string, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true,
  });
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [categoryFilterLocal, setCategoryFilterLocal] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sort & pagination
  const [sort, setSort] = useState<SortConfig>({ field: 'created_at', dir: 'desc' });
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const agents = useMemo(() => getAgentList(allTickets), [allTickets]);
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allTickets.forEach(t => { if (t.category_name) cats.add(t.category_name); });
    return Array.from(cats).sort();
  }, [allTickets]);

  const handleSort = useCallback((field: SortField) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  }, []);

  // Apply local filters
  const localFiltered = useMemo(() => {
    return allTickets.filter(t => {
      if (!statusChecks[t.status]) return false;
      if (!priorityChecks[t.priority]) return false;
      if (assigneeFilter === 'unassigned' && t.assigned_to_name) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && t.assigned_to_name !== assigneeFilter) return false;
      if (categoryFilterLocal !== 'all' && t.category_name !== categoryFilterLocal) return false;
      if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [allTickets, statusChecks, priorityChecks, assigneeFilter, categoryFilterLocal, dateFrom, dateTo]);

  const sorted = useMemo(() => sortTickets(localFiltered, sort), [localFiltered, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  // Reset page when filters change
  useMemo(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  // Summary stats
  const summary = useMemo(() => {
    const byStatus: Record<string, number> = {};
    localFiltered.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
    const openTickets = localFiltered.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'pending');
    const avgAgeHrs = openTickets.length
      ? openTickets.reduce((sum, t) => sum + getAgeHours(t.created_at), 0) / openTickets.length
      : 0;
    const slaBreached = localFiltered.filter(t => t.sla_breached).length;
    return { total: localFiltered.length, byStatus, avgAgeHrs, slaBreached };
  }, [localFiltered]);

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sort.field !== field) return <ArrowUpDown size={10} style={{ opacity: 0.3, marginLeft: 4 }} />;
    return sort.dir === 'asc'
      ? <ChevronUp size={10} style={{ marginLeft: 4 }} />
      : <ChevronDown size={10} style={{ marginLeft: 4 }} />;
  };

  return (
    <div className="ticket-queue-container" style={{ display: 'flex', gap: 16, position: 'relative' }}>
      {/* Mobile filter toggle */}
      <button
        className="mobile-filter-toggle"
        onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
        aria-label="Toggle filters"
        aria-expanded={mobileFiltersOpen}
        style={{
          display: 'none',
          position: 'absolute',
          top: -48,
          left: 0,
          zIndex: 10,
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Filter size={14} /> Filters
      </button>

      {/* ── Filters Panel ── */}
      <div className={`ticket-queue-filters ${mobileFiltersOpen ? 'mobile-open' : ''}`} style={{
        width: 250,
        flexShrink: 0,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        position: 'sticky',
        top: 80,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          <Filter size={14} /> Filters
        </div>

        {/* Status */}
        <div>
          <div style={STYLE.filterLabel}>Status</div>
          {['open', 'in_progress', 'pending', 'resolved'].map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', padding: '2px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={statusChecks[s]}
                onChange={() => setStatusChecks(prev => ({ ...prev, [s]: !prev[s] }))}
                style={{ accentColor: STATUS_BADGE_COLORS[s] }}
              />
              {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </label>
          ))}
        </div>

        {/* Priority */}
        <div>
          <div style={STYLE.filterLabel}>Priority</div>
          {['critical', 'high', 'medium', 'low'].map(p => (
            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', padding: '2px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={priorityChecks[p]}
                onChange={() => setPriorityChecks(prev => ({ ...prev, [p]: !prev[p] }))}
                style={{ accentColor: PRIORITY_BADGE_COLORS[p] }}
              />
              {p === 'critical' ? 'P1' : p === 'high' ? 'P2' : p === 'medium' ? 'P3' : 'P4'}
            </label>
          ))}
        </div>

        {/* Assignee */}
        <div>
          <div style={STYLE.filterLabel}>Assignee</div>
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--border)', fontSize: 12,
              background: 'var(--bg)', color: 'var(--text)',
            }}
          >
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Category */}
        <div>
          <div style={STYLE.filterLabel}>Category</div>
          <select
            value={categoryFilterLocal}
            onChange={e => setCategoryFilterLocal(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--border)', fontSize: 12,
              background: 'var(--bg)', color: 'var(--text)',
            }}
          >
            <option value="all">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <div style={STYLE.filterLabel}>Created Date</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: 11,
                background: 'var(--bg)', color: 'var(--text)',
              }}
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: 11,
                background: 'var(--bg)', color: 'var(--text)',
              }}
              placeholder="To"
            />
          </div>
        </div>

        {/* Clear */}
        <button
          onClick={() => {
            setStatusChecks({ open: true, in_progress: true, pending: true, resolved: true });
            setPriorityChecks({ critical: true, high: true, medium: true, low: true });
            setAssigneeFilter('all');
            setCategoryFilterLocal('all');
            setDateFrom('');
            setDateTo('');
            setPage(1);
          }}
          style={{
            fontSize: 12, color: 'var(--accent)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* ── Ticket List Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {/* Summary Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          padding: '10px 16px', background: 'var(--bg-elevated)',
          border: '1px solid var(--border)', borderRadius: 10, fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
            {summary.total} ticket{summary.total !== 1 ? 's' : ''}
          </span>
          {Object.entries(summary.byStatus).map(([s, c]) => (
            <span key={s} style={STYLE.badge(STATUS_BADGE_COLORS[s] || '#6B7280', STATUS_BADGE_COLORS[s] || '#6B7280')}>
              {s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: {c}
            </span>
          ))}
          <span style={{ color: 'var(--text-muted)' }}>
            Avg age: <strong>{summary.avgAgeHrs < 24 ? `${summary.avgAgeHrs.toFixed(1)}h` : `${(summary.avgAgeHrs / 24).toFixed(1)}d`}</strong>
          </span>
          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
            SLA breaches: {summary.slaBreached}
          </span>
        </div>

        {/* Table */}
        <CardSection title={`Tickets (${paged.length})`} icon={TicketIcon}>
          <div style={{ overflowX: 'auto' }}>
            <table
              role="table"
              aria-label="Ticket queue"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th onClick={() => handleSort('number')} style={STYLE.tableHeader}>
                    # <SortIndicator field="number" />
                  </th>
                  <th style={{ ...STYLE.tableHeader, cursor: 'default' }}>Subject</th>
                  <th onClick={() => handleSort('priority')} style={STYLE.tableHeader}>
                    Priority <SortIndicator field="priority" />
                  </th>
                  <th onClick={() => handleSort('status')} style={STYLE.tableHeader}>
                    Status <SortIndicator field="status" />
                  </th>
                  <th onClick={() => handleSort('assignee')} style={STYLE.tableHeader}>
                    Assignee <SortIndicator field="assignee" />
                  </th>
                  <th onClick={() => handleSort('category')} style={STYLE.tableHeader}>
                    Category <SortIndicator field="category" />
                  </th>
                  <th onClick={() => handleSort('created_at')} style={STYLE.tableHeader}>
                    Created <SortIndicator field="created_at" />
                  </th>
                  <th style={{ ...STYLE.tableHeader, cursor: 'default' }}>SLA</th>
                  <th onClick={() => handleSort('age')} style={STYLE.tableHeader}>
                    Age <SortIndicator field="age" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map(t => {
                  const sla = getSlaStatus(t);
                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => onDrillDown?.({
                        label: `Ticket #${t.number}`,
                        filterKey: 'status',
                        filterValue: t.status,
                        count: 1,
                      })}
                    >
                      <td style={STYLE.tableCell}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 11 }}>
                          #{t.number}
                        </span>
                      </td>
                      <td style={{ ...STYLE.tableCell, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {t.title}
                      </td>
                      <td style={STYLE.tableCell}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: PRIORITY_BADGE_COLORS[t.priority] || 'var(--text)',
                        }}>
                          {t.priority === 'critical' ? 'P1' : t.priority === 'high' ? 'P2' : t.priority === 'medium' ? 'P3' : 'P4'}
                        </span>
                      </td>
                      <td style={STYLE.tableCell}>
                        <span style={STYLE.badge(
                          STATUS_BADGE_COLORS[t.status] || '#6B7280',
                          STATUS_BADGE_COLORS[t.status] || '#6B7280',
                        )}>
                          {t.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td style={{ ...STYLE.tableCell, color: t.assigned_to_name ? 'var(--text)' : 'var(--text-muted)', fontSize: 12 }}>
                        {t.assigned_to_name || 'Unassigned'}
                      </td>
                      <td style={{ ...STYLE.tableCell, color: 'var(--text-muted)', fontSize: 12 }}>
                        {t.category_name || '—'}
                      </td>
                      <td style={{ ...STYLE.tableCell, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {getRelativeTime(t.created_at)}
                      </td>
                      <td style={STYLE.tableCell}>
                        {sla === 'breached' ? (
                          <XCircle size={16} color={SLA_STATUS_COLORS.breached} />
                        ) : sla === 'warning' ? (
                          <AlertTriangle size={16} color={SLA_STATUS_COLORS.warning} />
                        ) : (
                          <CheckCircle size={16} color={SLA_STATUS_COLORS.ok} />
                        )}
                      </td>
                      <td style={{ ...STYLE.tableCell, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {getAge(t.created_at)}
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No tickets match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {sorted.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0 0 0', fontSize: 12, color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-subtle)', marginTop: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{
                    padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)',
                    fontSize: 12, background: 'var(--bg)', color: 'var(--text)',
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{sorted.length} total</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    aria-label="Previous page"
                    style={{
                      padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)',
                      fontSize: 12, background: 'var(--bg)', color: page <= 1 ? 'var(--text-muted)' : 'var(--text)',
                      cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                    }}
                  >
                    Prev
                  </button>
                  <span style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }} aria-live="polite">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                    style={{
                      padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)',
                      fontSize: 12, background: 'var(--bg)', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)',
                      cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardSection>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .ticket-queue-container { flex-direction: column !important; }
          .mobile-filter-toggle { display: flex !important; }
          .ticket-queue-filters {
            width: 100% !important;
            position: static !important;
            max-height: none !important;
            display: none !important;
          }
          .ticket-queue-filters.mobile-open { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: Agent Workload
// ═══════════════════════════════════════════════════════════════════════════════

function AgentWorkloadTab({
  tickets,
  agentPerformance,
  onExportCSV,
  onDrillDown,
  onCrossFilterChange,
  pinProps,
}: {
  tickets: Ticket[];
  agentPerformance: AgentPerf[];
  onExportCSV: (section: string) => void;
  onDrillDown?: (level: DrillDownLevel) => void;
  onCrossFilterChange?: (key: string, value: string | null) => void;
  pinProps: (key: string, label: string, type?: string) => Record<string, any>;
}) {
  // ── Compute workload from tickets ──
  const agentWorkload = useMemo(() => {
    const map = new Map<string, { open: number; inProgress: number; pending: number; totalActive: number }>();
    tickets.forEach(t => {
      const name = t.assigned_to_name || 'Unassigned';
      if (!map.has(name)) map.set(name, { open: 0, inProgress: 0, pending: 0, totalActive: 0 });
      const entry = map.get(name)!;
      entry.totalActive++;
      if (t.status === 'open') entry.open++;
      else if (t.status === 'in_progress') entry.inProgress++;
      else if (t.status === 'pending') entry.pending++;
    });

    // Merge with agentPerformance for avg resolution time and sla compliance
    const perfMap = new Map(agentPerformance.map(a => [a.name, a]));

    return Array.from(map.entries())
      .filter(([name]) => name !== 'Unassigned')
      .map(([name, counts]) => {
        const perf = perfMap.get(name);
        const avgResHrs = perf && perf.resolved ? perf.totalResTime / perf.resolved / 3600000 : 0;
        const slaCompliance = perf && (perf.count + perf.breaches) > 0
          ? Math.round((1 - perf.breaches / (perf.count + perf.breaches)) * 100)
          : 100;
        return { name, ...counts, avgResHrs, slaCompliance };
      })
      .sort((a, b) => b.totalActive - a.totalActive);
  }, [tickets, agentPerformance]);

  // ── Donut: Tickets by assignee ──
  const assigneeDonutData = useMemo(() => {
    const top10 = agentWorkload.slice(0, 10);
    const otherCount = agentWorkload.slice(10).reduce((sum, a) => sum + a.totalActive, 0);
    const colors = ['#3B82F6', '#F97316', '#EAB308', '#16A34A', '#8B5CF6', '#EC4899', '#06B6D4', '#F43F5E', '#6366F1', '#14B8A6'];
    const data = top10.map((a, i) => ({
      name: a.name,
      value: a.totalActive,
      color: colors[i % colors.length],
    }));
    if (otherCount > 0) data.push({ name: 'Other', value: otherCount, color: '#9CA3AF' });
    return data;
  }, [agentWorkload]);

  // ── Stacked bar: Open tickets by priority per agent ──
  const priorityByAgentBarData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    tickets.forEach(t => {
      const name = t.assigned_to_name || 'Unassigned';
      if (name === 'Unassigned') return;
      if (!map.has(name)) map.set(name, { critical: 0, high: 0, medium: 0, low: 0 });
      const entry = map.get(name)!;
      entry[t.priority] = (entry[t.priority] || 0) + 1;
    });
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        P1: counts.critical || 0,
        P2: counts.high || 0,
        P3: counts.medium || 0,
        P4: counts.low || 0,
      }))
      .sort((a, b) => (b.P1 + b.P2 + b.P3 + b.P4) - (a.P1 + a.P2 + a.P2 + a.P4));
  }, [tickets]);

  // ── Aggregate resolved per agent ──
  const resolvedAggregate = useMemo(() => {
    return agentPerformance
      .filter(a => a.resolved > 0)
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 10);
  }, [agentPerformance]);

  // ── Unassigned tickets ──
  const unassigned = useMemo(() => {
    const all = tickets.filter(t => !t.assigned_to_name);
    const byPriority: Record<string, number> = {};
    all.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1; });
    const avgWaitHrs = all.length
      ? all.reduce((sum, t) => sum + getAgeHours(t.created_at), 0) / all.length
      : 0;
    const oldest10 = [...all].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, 10);
    return { total: all.length, byPriority, avgWaitHrs, oldest10 };
  }, [tickets]);

  // ── Workload indicator bar (max capacity 20) ──
  const maxActive = Math.max(...agentWorkload.map(a => a.totalActive), 1);
  const workloadCap = Math.max(maxActive * 1.5, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Upper section: 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16, alignItems: 'start' }}>
        {/* ── Left: Agent Queue Summary ── */}
        <CardSection title="Agent Queue Summary" icon={Users} {...pinProps('agent_queue_summary', 'Agent Queue Summary', 'table')}>
          <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Agent', 'Open', 'In Prog.', 'Pending', 'Active', 'Avg Res.', 'SLA %', 'Capacity'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentWorkload.map(a => (
                  <tr key={a.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: '8px 10px', color: STATUS_BADGE_COLORS.open }}>{a.open}</td>
                    <td style={{ padding: '8px 10px', color: STATUS_BADGE_COLORS.in_progress }}>{a.inProgress}</td>
                    <td style={{ padding: '8px 10px', color: STATUS_BADGE_COLORS.pending }}>{a.pending}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{a.totalActive}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                      {a.avgResHrs < 1 ? '<1h' : a.avgResHrs < 24 ? `${a.avgResHrs.toFixed(1)}h` : `${(a.avgResHrs / 24).toFixed(1)}d`}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        color: a.slaCompliance >= 95 ? 'var(--success)' : a.slaCompliance >= 80 ? 'var(--warning)' : 'var(--danger)',
                        background: a.slaCompliance >= 95 ? 'var(--success-bg)' : a.slaCompliance >= 80 ? 'var(--warning-bg)' : 'var(--danger-bg)',
                      }}>
                        {a.slaCompliance}%
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', minWidth: 80 }}>
                      <MiniBar value={a.totalActive} max={workloadCap} color={a.totalActive > workloadCap * 0.8 ? 'var(--warning)' : 'var(--accent)'} />
                    </td>
                  </tr>
                ))}
                {agentWorkload.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No agent data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardSection>

        {/* ── Right: Workload Distribution Charts ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Donut: Tickets by Assignee */}
          {assigneeDonutData.length > 0 && (
            <CardSection title="Tickets by Assignee" icon={Users} {...pinProps('chart_tickets_by_assignee', 'Tickets by Assignee', 'chart')}>
              <InteractiveDonutChart
                data={assigneeDonutData}
                height={220}
                showExport={true}
                exportFilename="tickets-by-assignee"
                total={assigneeDonutData.reduce((s, d) => s + d.value, 0)}
                totalLabel="tickets"
                onSegmentClick={
                  onDrillDown || onCrossFilterChange
                    ? (seg) => {
                        onCrossFilterChange?.('assignee', seg.name);
                        onDrillDown?.({
                          label: `Assignee: ${seg.name}`,
                          filterKey: 'assignee',
                          filterValue: seg.name,
                          count: seg.value,
                        });
                      }
                    : undefined
                }
              />
            </CardSection>
          )}

          {/* Stacked Bar: Open tickets by priority per agent */}
          {priorityByAgentBarData.length > 0 && (
            <CardSection title="Open Tickets by Priority" icon={LayoutGrid} {...pinProps('chart_open_by_priority', 'Open Tickets by Priority', 'chart')}>
              <InteractiveBarChart
                data={priorityByAgentBarData.slice(0, 10)}
                layout="horizontal"
                height={Math.max(180, Math.min(priorityByAgentBarData.length, 10) * 50)}
                showExport={true}
                exportFilename="open-tickets-by-priority-per-agent"
                series={[
                  { dataKey: 'P4', name: 'P4 - Low', color: '#3B82F6' },
                  { dataKey: 'P3', name: 'P3 - Medium', color: '#EAB308' },
                  { dataKey: 'P2', name: 'P2 - High', color: '#F97316' },
                  { dataKey: 'P1', name: 'P1 - Critical', color: '#EF4444' },
                ]}
              />
            </CardSection>
          )}
        </div>
      </div>

      {/* ── Tickets Resolved Per Agent (Aggregate) ── */}
      {resolvedAggregate.length > 0 && (
        <CardSection title="Resolved Tickets per Agent" icon={TrendingUp} {...pinProps('chart_resolved_trend', 'Resolved per Agent', 'table')}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Agent</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Resolved</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Avg Resolution</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>SLA %</th>
                </tr>
              </thead>
              <tbody>
                {resolvedAggregate.map(a => (
                  <tr key={a.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{a.resolved}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                      {a.totalResTime && a.resolved ? (a.totalResTime / a.resolved / 3600000 < 1
                        ? `${Math.round(a.totalResTime / a.resolved / 36000)}m`
                        : `${(a.totalResTime / a.resolved / 3600000).toFixed(1)}h`
                      ) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        color: a.breaches === 0 ? 'var(--success)' : 'var(--danger)',
                        background: a.breaches === 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                      }}>
                        {a.breaches === 0 ? '100%' : `${Math.round((1 - a.breaches / (a.count + a.breaches)) * 100)}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 0 0', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Daily resolution trend not available at this time.
          </div>
        </CardSection>
      )}

      {/* ── Bottom: Unassigned Tickets ── */}
      <CardSection title="Unassigned Tickets" icon={UserPlus} {...pinProps('unassigned_tickets', 'Unassigned Tickets', 'table')}>
        {unassigned.total > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary mini-cards */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unassigned</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{unassigned.total}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {Object.entries(unassigned.byPriority).map(([p, c]) => (
                  <div key={p} style={{
                    padding: '6px 10px', borderRadius: 6,
                    background: (PRIORITY_BADGE_COLORS[p] || '#6B7280') + '15',
                    border: `1px solid ${(PRIORITY_BADGE_COLORS[p] || '#6B7280')}30`,
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {p === 'critical' ? 'P1' : p === 'high' ? 'P2' : p === 'medium' ? 'P3' : 'P4'}
                    </span>
                    <div style={{ fontSize: 16, fontWeight: 700, color: PRIORITY_BADGE_COLORS[p] || 'var(--text)' }}>{c}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Wait</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {unassigned.avgWaitHrs < 1 ? '<1h' : unassigned.avgWaitHrs < 24 ? `${unassigned.avgWaitHrs.toFixed(1)}h` : `${(unassigned.avgWaitHrs / 24).toFixed(1)}d`}
                </div>
              </div>
            </div>

            {/* Oldest unassigned table */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Oldest Unassigned Tickets (Top 10)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Subject</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Priority</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.oldest10.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 600, fontSize: 11 }}>#{t.number}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_BADGE_COLORS[t.priority] || 'var(--text)' }}>
                          {t.priority === 'critical' ? 'P1' : t.priority === 'high' ? 'P2' : t.priority === 'medium' ? 'P3' : 'P4'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{getAge(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No unassigned tickets.
          </div>
        )}
      </CardSection>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: Operational Metrics
// ═══════════════════════════════════════════════════════════════════════════════

function OperationalMetricsTab({
  tickets,
  pinProps,
}: {
  tickets: Ticket[];
  pinProps: (key: string, label: string, type?: string) => Record<string, any>;
}) {
  // ── KPI computations ──
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

  const kpis = useMemo(() => {
    const createdToday = tickets.filter(t => t.created_at >= todayStart).length;
    const createdYesterday = tickets.filter(t => t.created_at >= yesterdayStart && t.created_at < todayStart).length;
    const resolvedToday = tickets.filter(t => t.resolved_at && t.resolved_at >= todayStart).length;
    const resolvedYesterday = tickets.filter(t => t.resolved_at && t.resolved_at >= yesterdayStart && t.resolved_at < todayStart).length;

    // Avg first response time (from first_response_at - created_at)
    const withResponse = tickets.filter(t => t.first_response_at);
    const avgFirstRespHrs = withResponse.length
      ? withResponse.reduce((sum, t) => sum + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / withResponse.length / 3600000
      : 0;

    // Avg resolution time
    const resolved = tickets.filter(t => t.resolved_at);
    const avgResHrs = resolved.length
      ? resolved.reduce((sum, t) => sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0) / resolved.length / 3600000
      : 0;

    // Backlog age (avg age of open tickets)
    const openTickets = tickets.filter(t => !['resolved', 'closed'].includes(t.status));
    const backlogAgeHrs = openTickets.length
      ? openTickets.reduce((sum, t) => sum + getAgeHours(t.created_at), 0) / openTickets.length
      : 0;

    // Reopen rate (tickets with reopened status / total resolved)
    const reopened = tickets.filter(t => t.status === 'open' && t.resolved_at).length;
    const reopenRate = resolved.length ? (reopened / resolved.length) * 100 : 0;

    return {
      createdToday, createdYesterday,
      resolvedToday, resolvedYesterday,
      avgFirstRespHrs, avgResHrs, backlogAgeHrs, reopenRate,
    };
  }, [tickets, todayStart, yesterdayStart]);

  // ── Heatmap: Ticket Volume by Hour/Day ──
  const heatmapData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const countMap = new Map<string, number>();
    tickets.forEach(t => {
      const d = new Date(t.created_at);
      const day = days[d.getDay()];
      const hour = String(d.getHours()).padStart(2, '0');
      const key = `${day}|${hour}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    return Array.from(countMap.entries()).map(([key, value]) => {
      const [day, hour] = key.split('|');
      return { day, hour, value };
    });
  }, [tickets]);

  // ── Resolution time trend (30 days) ──
  const resTrendData = useMemo(() => {
    const days: { name: string; avgHours: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayTickets = tickets.filter(t => t.resolved_at && t.resolved_at.slice(0, 10) === dateStr);
      const avgHrs = dayTickets.length
        ? dayTickets.reduce((sum, t) => sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0) / dayTickets.length / 3600000
        : 0;
      days.push({ name: dayLabel, avgHours: Math.round(avgHrs * 10) / 10 });
    }
    return days;
  }, [tickets]);

  // ── Ticket Flow (stacked area: created, resolved, closed) ──
  const flowData = useMemo(() => {
    const days: { name: string; Created: number; Resolved: number; Closed: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({
        name: dayLabel,
        Created: tickets.filter(t => t.created_at.slice(0, 10) === dateStr).length,
        Resolved: tickets.filter(t => t.resolved_at && t.resolved_at.slice(0, 10) === dateStr).length,
        Closed: tickets.filter(t => t.closed_at && t.closed_at.slice(0, 10) === dateStr).length,
      });
    }
    return days;
  }, [tickets]);

  // ── Priority Distribution Over Time (12 weeks) ──
  const priorityTrendData = useMemo(() => {
    const weeks: { name: string; P1: number; P2: number; P3: number; P4: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const weekLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const weekTickets = tickets.filter(t => {
        const d = new Date(t.created_at);
        return d >= start && d <= new Date(end.getTime() + 86400000);
      });
      weeks.push({
        name: weekLabel,
        P1: weekTickets.filter(t => t.priority === 'critical').length,
        P2: weekTickets.filter(t => t.priority === 'high').length,
        P3: weekTickets.filter(t => t.priority === 'medium').length,
        P4: weekTickets.filter(t => t.priority === 'low').length,
      });
    }
    return weeks;
  }, [tickets]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── KPI Cards Row (6 cards) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <ScorecardWidget
          label="Tickets Created Today"
          value={kpis.createdToday}
          icon={TicketIcon}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{
            value: kpis.createdYesterday ? Math.round(Math.abs(kpis.createdToday - kpis.createdYesterday) / kpis.createdYesterday * 100) : 0,
            label: 'vs yesterday',
            isPositive: kpis.createdToday >= kpis.createdYesterday,
          }}
          {...pinProps('kpi_created_today', 'Tickets Created Today')}
        />
        <ScorecardWidget
          label="Tickets Resolved Today"
          value={kpis.resolvedToday}
          icon={CheckCircle}
          iconColor="var(--success)"
          iconBg="var(--success-bg)"
          accentColor="var(--success)"
          change={{
            value: kpis.resolvedYesterday ? Math.round(Math.abs(kpis.resolvedToday - kpis.resolvedYesterday) / kpis.resolvedYesterday * 100) : 0,
            label: 'vs yesterday',
            isPositive: kpis.resolvedToday >= kpis.resolvedYesterday,
          }}
          {...pinProps('kpi_resolved_today', 'Tickets Resolved Today')}
        />
        <ScorecardWidget
          label="Avg First Response Time"
          value={kpis.avgFirstRespHrs < 1 ? `${Math.round(kpis.avgFirstRespHrs * 60)}m` : `${kpis.avgFirstRespHrs.toFixed(1)}h`}
          icon={Clock}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          target={{ current: kpis.avgFirstRespHrs, target: 4, label: `${kpis.avgFirstRespHrs.toFixed(1)}h / 4h` }}
          {...pinProps('kpi_avg_first_response', 'Avg First Response Time')}
        />
        <ScorecardWidget
          label="Avg Resolution Time"
          value={kpis.avgResHrs < 1 ? `${Math.round(kpis.avgResHrs * 60)}m` : `${kpis.avgResHrs.toFixed(1)}h`}
          icon={TrendingUp}
          iconColor={kpis.avgResHrs <= 22 ? 'var(--success)' : 'var(--danger)'}
          iconBg={kpis.avgResHrs <= 22 ? 'var(--success-bg)' : 'var(--danger-bg)'}
          accentColor={kpis.avgResHrs <= 22 ? 'var(--success)' : 'var(--danger)'}
          target={{ current: kpis.avgResHrs, target: 22, label: `${kpis.avgResHrs.toFixed(1)}h / 22h` }}
          {...pinProps('kpi_avg_resolution', 'Avg Resolution Time')}
        />
        <ScorecardWidget
          label="Backlog Age"
          value={kpis.backlogAgeHrs < 24 ? `${kpis.backlogAgeHrs.toFixed(1)}h` : `${(kpis.backlogAgeHrs / 24).toFixed(1)}d`}
          icon={AlertTriangle}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          {...pinProps('kpi_backlog_age', 'Backlog Age')}
        />
        <ScorecardWidget
          label="Reopen Rate"
          value={`${kpis.reopenRate.toFixed(1)}%`}
          icon={XCircle}
          iconColor={kpis.reopenRate <= 10 ? 'var(--success)' : 'var(--danger)'}
          iconBg={kpis.reopenRate <= 10 ? 'var(--success-bg)' : 'var(--danger-bg)'}
          accentColor={kpis.reopenRate <= 10 ? 'var(--success)' : 'var(--danger)'}
          target={{ current: kpis.reopenRate, target: 10, label: `${kpis.reopenRate.toFixed(1)}% / 10%` }}
          {...pinProps('kpi_reopen_rate', 'Reopen Rate')}
        />
      </div>

      {/* ── Charts Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16 }}>
        {/* Top-left: Heatmap */}
        <CardSection title="Ticket Volume by Hour" icon={LayoutGrid} {...pinProps('chart_volume_heatmap', 'Ticket Volume by Hour', 'chart')}>
          <HeatmapChart
            data={heatmapData}
            days={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
            hours={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))}
            rowHeight={22}
            showExport={true}
            exportFilename="ticket-volume-heatmap"
            showValues={false}
          />
        </CardSection>

        {/* Top-right: Resolution Time Trend */}
        <CardSection title="Resolution Time Trend (30 days)" icon={TrendingUp} {...pinProps('chart_resolution_trend', 'Resolution Time Trend', 'chart')}>
          <InteractiveLineChart
            data={resTrendData}
            series={[
              { dataKey: 'avgHours', name: 'Avg Resolution Time', color: 'var(--accent)', strokeWidth: 2 },
              ...(resTrendData.length > 0 ? [{
                dataKey: 'target22',
                name: 'Target (22hrs)',
                color: 'var(--danger)',
                strokeDasharray: '5 5',
                strokeWidth: 1.5,
                dot: false as const,
              }] : []),
            ]}
            height={240}
            showExport={true}
            showGrid={true}
            exportFilename="resolution-time-trend"
            yLabel="Hours"
            xLabel="Date"
            unit="hrs"
          />
        </CardSection>

        {/* Bottom-left: Ticket Flow */}
        <CardSection title="Ticket Flow (30 days)" icon={TrendingUp} {...pinProps('chart_ticket_flow', 'Ticket Flow', 'chart')}>
          <InteractiveAreaChart
            data={flowData}
            series={[
              { dataKey: 'Created', name: 'Created', color: '#3B82F6', stackId: '1' },
              { dataKey: 'Resolved', name: 'Resolved', color: '#16A34A', stackId: '1' },
              { dataKey: 'Closed', name: 'Closed', color: '#6B7280', stackId: '1' },
            ]}
            height={240}
            showExport={true}
            showGrid={true}
            exportFilename="ticket-flow"
            yLabel="Tickets"
            xLabel="Date"
          />
        </CardSection>

        {/* Bottom-right: Priority Distribution Over Time */}
        <CardSection title="Priority Distribution Over Time (12 weeks)" icon={LayoutGrid} {...pinProps('chart_priority_trend', 'Priority Distribution Over Time', 'chart')}>
          <InteractiveBarChart
            data={priorityTrendData}
            layout="vertical"
            height={240}
            showExport={true}
            exportFilename="priority-distribution-trend"
            series={[
              { dataKey: 'P4', name: 'P4 - Low', color: '#3B82F6' },
              { dataKey: 'P3', name: 'P3 - Medium', color: '#EAB308' },
              { dataKey: 'P2', name: 'P2 - High', color: '#F97316' },
              { dataKey: 'P1', name: 'P1 - Critical', color: '#EF4444' },
            ]}
          />
        </CardSection>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: Portal & Self-Service
// ═══════════════════════════════════════════════════════════════════════════════

function PortalSectionTab({
  tickets,
  portalStats,
  knowledgeStats,
  pinProps,
}: {
  tickets: Ticket[];
  portalStats: PortalStats;
  knowledgeStats?: KnowledgeStats | null;
  pinProps: (key: string, label: string, type?: string) => Record<string, any>;
}) {
  // ── Top services requested ──
  const topServices = useMemo(() => {
    const countMap = new Map<string, number>();
    tickets.filter(t => t.ticket_type === 'service_request').forEach(t => {
      const cat = t.category_name || 'Other';
      countMap.set(cat, (countMap.get(cat) || 0) + 1);
    });
    return Array.from(countMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [tickets]);

  // ── KB views daily trend (real data) ──
  const kbViewsDaily = useMemo(() => {
    if (!knowledgeStats?.viewsDaily) return [];
    return knowledgeStats.viewsDaily.map(d => ({
      name: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.date,
      views: d.count,
    }));
  }, [knowledgeStats]);

  // ── Top viewed KB articles (real data) ──
  const topKbArticles = useMemo(() => {
    if (!knowledgeStats?.topViewed) return [];
    return knowledgeStats.topViewed.slice(0, 10).map(a => ({
      title: a.title,
      views: a.views,
      helpful: a.helpful_count,
      notHelpful: a.not_helpful_count,
    }));
  }, [knowledgeStats]);

  // Real KB view count from knowledgeStats
  const realKbViewsTotal = knowledgeStats?.total ?? null;
  const realKbViews30d = knowledgeStats?.viewsDaily
    ? knowledgeStats.viewsDaily.reduce((sum, d) => sum + d.count, 0)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <ScorecardWidget
          label="Portal Logins (30d)"
          value="Feature not yet tracked."
          icon={Monitor}
          iconColor="var(--text-muted)"
          iconBg="var(--bg-secondary)"
          accentColor="var(--text-muted)"
          {...pinProps('portal_logins', 'Portal Logins')}
        />
        <ScorecardWidget
          label="Self-Service Tickets"
          value="Feature not yet tracked."
          icon={TicketIcon}
          iconColor="var(--text-muted)"
          iconBg="var(--bg-secondary)"
          accentColor="var(--text-muted)"
          {...pinProps('portal_self_service_pct', 'Self-Service Tickets')}
        />
        <ScorecardWidget
          label="KB Article Views (30d)"
          value={realKbViews30d !== null ? realKbViews30d : '—'}
          icon={BookOpen}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('portal_kb_views', 'KB Article Views')}
        />
        <ScorecardWidget
          label="Deflection Rate"
          value="Feature not yet tracked."
          icon={CheckCircle}
          iconColor="var(--text-muted)"
          iconBg="var(--bg-secondary)"
          accentColor="var(--text-muted)"
          {...pinProps('portal_deflection_rate', 'Deflection Rate')}
        />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16 }}>
        {/* Top services requested */}
        <CardSection title="Top Services Requested" icon={TrendingUp} {...pinProps('chart_top_services', 'Top Services Requested', 'chart')}>
          <InteractiveBarChart
            data={topServices}
            layout="horizontal"
            height={Math.max(200, topServices.length * 40)}
            showExport={true}
            exportFilename="top-services-requested"
            color="var(--accent)"
          />
        </CardSection>

        {/* KB Views Trend / Portal Usage */}
        <CardSection title="Portal Usage by Hour" icon={Monitor} {...pinProps('chart_portal_usage', 'Portal Usage by Hour', 'chart')}>
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Feature not yet tracked.
          </div>
        </CardSection>
      </div>

      {/* ── KB Charts Row (if data available) ── */}
      {kbViewsDaily.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16 }}>
          <CardSection title="KB Article Views (Daily)" icon={BookOpen} {...pinProps('chart_kb_views_daily', 'KB Article Views Daily', 'chart')}>
            <InteractiveLineChart
              data={kbViewsDaily}
              series={[
                { dataKey: 'views', name: 'Views', color: 'var(--accent)', dot: false },
              ]}
              height={220}
              showExport={true}
              showGrid={true}
              exportFilename="kb-views-daily"
              yLabel="Views"
              xLabel="Date"
            />
          </CardSection>

          {/* Top Viewed Articles */}
          {topKbArticles.length > 0 && (
            <CardSection title="Top Viewed KB Articles" icon={Search} {...pinProps('table_top_kb_articles', 'Top Viewed KB Articles', 'table')}>
              <MiniTable
                headers={['Article', 'Views', 'Helpful', 'Not Helpful']}
                rows={topKbArticles.map(a => [
                  <span key="title" style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{a.title}</span>,
                  <span key="views" style={{ fontWeight: 700 }}>{a.views}</span>,
                  <span key="helpful" style={{ color: 'var(--success)', fontWeight: 600 }}>{a.helpful}</span>,
                  <span key="not-helpful" style={{ color: 'var(--danger)', fontWeight: 600 }}>{a.notHelpful}</span>,
                ])}
                emptyMessage="No KB article data available."
              />
            </CardSection>
          )}
        </div>
      )}

      {/* ── Tables Row: KB search / failed searches ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16 }}>
        {/* KB Search Terms */}
        <CardSection title="KB Search Terms" icon={Search} {...pinProps('table_kb_search_terms', 'KB Search Terms', 'table')}>
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Feature not yet tracked.
          </div>
        </CardSection>

        {/* Failed Searches */}
        <CardSection title="Failed Searches" icon={AlertTriangle} {...pinProps('table_failed_searches', 'Failed Searches', 'table')}>
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Feature not yet tracked.
          </div>
        </CardSection>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function OperationalSection(props: OperationalSectionProps) {
  const {
    filteredTickets, tickets, categories, categoryFilter, onCategoryChange,
    priorityFilter, onPriorityChange, statusFilter, onStatusChange,
    searchQuery, onSearchChange, agentPerformance, portalStats, knowledgeStats,
    isAdminOrAgent, onExportCSV, onDrillDown, onCrossFilterChange,
    isMetricPinned, handlePin, handleUnpin,
  } = props;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('ticket-queue');

  function pinProps(key: string, label: string, type: string = 'kpi') {
    return (isMetricPinned && handlePin && handleUnpin) ? {
      metricKey: key,
      metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, type),
      onUnpin: () => handleUnpin(key),
    } : {};
  }

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Sub-tab Navigation ── */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
        paddingBottom: 8, flexWrap: 'wrap',
      }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === st.key ? 'var(--accent-subtle)' : 'transparent',
              color: activeSubTab === st.key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <st.icon size={14} />
            {st.label}
          </button>
        ))}
      </div>

      {/* ── Sub-tab Content ── */}
      {activeSubTab === 'ticket-queue' && (
        <TicketQueueTab
          tickets={filteredTickets}
          allTickets={tickets}
          onDrillDown={onDrillDown}
          pinProps={pinProps}
        />
      )}
      {activeSubTab === 'agent-workload' && (
        <AgentWorkloadTab
          tickets={tickets}
          agentPerformance={agentPerformance}
          onExportCSV={onExportCSV}
          onDrillDown={onDrillDown}
          onCrossFilterChange={onCrossFilterChange}
          pinProps={pinProps}
        />
      )}
      {activeSubTab === 'operational-metrics' && (
        <OperationalMetricsTab
          tickets={tickets}
          pinProps={pinProps}
        />
      )}
      {activeSubTab === 'portal' && (
        <PortalSectionTab
          tickets={tickets}
          portalStats={portalStats}
          pinProps={pinProps}
        />
      )}
    </div>
  );
}
